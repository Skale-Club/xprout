/**
 * Server side of AI billing: which key serves a call, falling back to the
 * global key when a client's key is rejected, and recording the real cost of
 * every OpenRouter call (usage.cost) in ai_usage_events.
 *
 *   const access = await resolveAiAccess(tenantId, 'translation')
 *   if (!access) return 503
 *   const result = await runAi(access, choice =>
 *     translateMenuTexts(openRouterModel(choice.apiKey, model, access.fetchFor(choice, model)), req))
 *
 * Rules (who pays) are pure in ./billing-rules.ts.
 */
import { createServiceClient } from '@/lib/supabase/server'
import { decryptApiKey } from '@/lib/crypto'
import { getRequestContext } from '@/lib/observability/context'
import { log } from '@/lib/observability/log'
import {
  chargeFor,
  clampMarkup,
  isKeyRejection,
  parseBillingMode,
  planAiAccess,
  type AiBillingMode,
  type AiFeature,
  type KeyChoice,
} from './billing-rules'
import { OPENROUTER_BASE_URL, platformOpenRouterKey } from './openrouter'
import { adminMenusOwned } from '@/lib/data/admin-menus'
import { readOwnedPlatformAiRecord, readOwnedTenantAiRecord, recordOwnedTenantAiKeyError, insertOwnedAiUsageRecord } from '@/lib/data/ai-access-runtime'

export interface PlatformAiSettings {
  platformKey: string | null
  /** Where the global key came from, for the panel. */
  platformKeySource: 'panel' | 'env' | 'none'
  defaultMode: AiBillingMode
  defaultMarkupPct: number
  usdToBrl: number
  /** The platform's default chat model as stored (null = the code default); resolve with resolveChatModel. */
  chatModel: string | null
}

export interface TenantAiSettings {
  mode: AiBillingMode | null
  key: string | null
  markupPct: number | null
  lastKeyError: string | null
  lastKeyErrorAt: string | null
  /** Off by default: only the platform sets this client's key until a superadmin lets the client manage it. */
  clientKeyAllowed: boolean
  /** A demo company (tenants.is_demo): same features, AI never billed. */
  isDemo: boolean
}

function decryptOrNull(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    return decryptApiKey(value) || null
  } catch {
    return null
  }
}

export async function loadPlatformAiSettings(): Promise<PlatformAiSettings> {
  const { data } = adminMenusOwned() ? { data: await readOwnedPlatformAiRecord() } : await createServiceClient()
    .from('platform_ai_settings')
    // '*' so the optional chat_model column is read when present (absent = no default chosen).
    .select('*')
    .eq('id', 1)
    .maybeSingle()
  const panelKey = decryptOrNull(data?.openrouter_api_key)
  const envKey = platformOpenRouterKey()
  return {
    platformKey: panelKey ?? envKey,
    platformKeySource: panelKey ? 'panel' : envKey ? 'env' : 'none',
    defaultMode: parseBillingMode(data?.default_billing_mode) ?? 'platform',
    defaultMarkupPct: clampMarkup(Number(data?.default_markup_pct ?? 30)),
    usdToBrl: Number(data?.usd_to_brl ?? 5.5) || 5.5,
    chatModel: typeof data?.chat_model === 'string' ? data.chat_model : null,
  }
}

export async function loadTenantAiSettings(tenantId: string): Promise<TenantAiSettings> {
  if (adminMenusOwned()) {
    const record = await readOwnedTenantAiRecord(tenantId)
    return tenantAiSettings(record, record?.is_demo === true)
  }
  const supabase = createServiceClient()
  const [{ data }, { data: tenantRow }] = await Promise.all([supabase
    .from('tenant_ai_settings')
    // '*' so the optional client_key_allowed column is read when present (absent = not allowed).
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle(),
    supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle()])
  return tenantAiSettings(data, (tenantRow as { is_demo?: unknown } | null)?.is_demo === true)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the two readers return the same untyped row
function tenantAiSettings(data: any, isDemo: boolean): TenantAiSettings {
  return {
    mode: parseBillingMode(data?.billing_mode),
    key: decryptOrNull(data?.openrouter_api_key),
    markupPct: data?.markup_pct == null ? null : Number(data.markup_pct),
    lastKeyError: data?.last_key_error ?? null,
    lastKeyErrorAt: data?.last_key_error_at ?? null,
    clientKeyAllowed: data?.client_key_allowed === true,
    isDemo,
  }
}

export interface ResolvedAiAccess {
  tenantId: string | null
  feature: AiFeature
  primary: KeyChoice
  fallback: KeyChoice | null
  /** The platform's default chat model, for resolveChatModel(tenantModel, access.platformChatModel). */
  platformChatModel: string | null
  /** A fetch that records the call's real cost under this key choice. */
  fetchFor: (choice: KeyChoice, model?: string) => typeof fetch
  /** Resolves once this access's streamed calls have written their cost to the ledger. */
  settle: () => Promise<void>
}

export async function resolveAiAccess(tenantId: string | null, feature: AiFeature): Promise<ResolvedAiAccess | null> {
  const [platform, tenant] = await Promise.all([
    loadPlatformAiSettings(),
    tenantId ? loadTenantAiSettings(tenantId) : Promise.resolve(null),
  ])
  const plan = planAiAccess({
    feature,
    tenantId,
    tenantMode: tenant?.mode ?? null,
    tenantKey: tenant?.key ?? null,
    tenantMarkupPct: tenant?.markupPct ?? null,
    platformKey: platform.platformKey,
    defaultMode: platform.defaultMode,
    defaultMarkupPct: platform.defaultMarkupPct,
    tenantIsDemo: tenant?.isDemo === true,
  })
  if (!plan) return null
  // Per access, so one guest's turn never waits for another guest's stream.
  const pending = new Set<Promise<void>>()
  return {
    tenantId,
    feature,
    ...plan,
    platformChatModel: platform.chatModel,
    fetchFor: (choice, model) => meteredFetch({ tenantId, feature, choice, model }, pending),
    settle: async () => { await Promise.allSettled([...pending]) },
  }
}

/** HTTP status of an AI SDK / OpenRouter error, through retry wrappers. */
export function errorStatus(error: unknown): number | null {
  const e = error as { statusCode?: unknown; status?: unknown; lastError?: unknown; cause?: unknown } | null
  if (!e || typeof e !== 'object') return null
  for (const value of [e.statusCode, e.status]) if (typeof value === 'number') return value
  return errorStatus(e.lastError) ?? errorStatus(e.cause)
}

/**
 * Runs the call with the primary key; if the client's key is rejected
 * (invalid / no credit / disabled) and a fallback exists, records why and
 * runs it again on the global key — billed to the client.
 */
export async function runAi<T>(access: ResolvedAiAccess, fn: (choice: KeyChoice) => Promise<T>): Promise<T> {
  try {
    return await fn(access.primary)
  } catch (error) {
    const status = errorStatus(error)
    if (!access.fallback || access.primary.keySource !== 'tenant' || !isKeyRejection(status)) throw error
    log.warn('ai.client_key_rejected', { feature: access.feature, status, tenant_id: access.tenantId })
    if (access.tenantId) {
      const message = `HTTP ${status}: ${error instanceof Error ? error.message.slice(0, 200) : 'rejected'}`
      const occurredAt = new Date().toISOString()
      if (adminMenusOwned()) await recordOwnedTenantAiKeyError(access.tenantId, message, occurredAt)
      else await createServiceClient()
        .from('tenant_ai_settings')
        .update({ last_key_error: message, last_key_error_at: occurredAt })
        .eq('tenant_id', access.tenantId)
    }
    return fn(access.fallback)
  }
}

interface UsageMeta {
  tenantId: string | null
  feature: AiFeature
  choice: KeyChoice
  model?: string
}

/** Records one call from its OpenRouter response body (usage.cost in USD). */
export async function recordAiUsage(meta: UsageMeta, body: unknown): Promise<void> {
  const json = (body ?? {}) as { id?: unknown; model?: unknown; usage?: { cost?: unknown } }
  const cost = Math.max(0, Number(json.usage?.cost ?? 0) || 0)
  const usage = {
    tenant_id: meta.tenantId,
    feature: meta.feature,
    model: typeof json.model === 'string' ? json.model : meta.model ?? null,
    key_source: meta.choice.keySource,
    billable: meta.choice.billable,
    cost_usd: cost,
    markup_pct: meta.choice.markupPct,
    charge_usd: chargeFor(cost, meta.choice.billable, meta.choice.markupPct),
    generation_id: typeof json.id === 'string' ? json.id : null,
    request_id: getRequestContext()?.requestId ?? null,
  }
  if (adminMenusOwned()) { await insertOwnedAiUsageRecord(usage); return }
  const { error } = await createServiceClient().from('ai_usage_events').insert(usage)
  if (error) log.error('ai.usage_record_failed', { err: error, feature: meta.feature })
}

/** Last chunk of an SSE body that carries `usage` (OpenRouter puts usage.cost in the final chunk). */
export function createSseUsageCollector() {
  let buffer = ''
  let last: { id?: unknown; model?: unknown; usage: unknown } | null = null
  const line = (raw: string) => {
    const text = raw.replace(/\r$/, '')
    if (!text.startsWith('data:')) return
    const data = text.slice(5).trim()
    if (!data || data === '[DONE]') return
    try {
      const chunk = JSON.parse(data) as { id?: unknown; model?: unknown; usage?: unknown }
      if (chunk && typeof chunk === 'object' && chunk.usage && typeof chunk.usage === 'object') last = { id: chunk.id, model: chunk.model, usage: chunk.usage }
    } catch { /* malformed line: ignored */ }
  }
  return {
    feed(chunk: string) {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      lines.forEach(line)
    },
    finish() { line(buffer); buffer = ''; return last },
  }
}

async function meterStream(meta: UsageMeta, stream: ReadableStream<Uint8Array>): Promise<void> {
  const collector = createSseUsageCollector()
  const decoder = new TextDecoder()
  try {
    const reader = stream.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      collector.feed(decoder.decode(value, { stream: true }))
    }
  } catch (err) {
    log.error('ai.usage_parse_failed', { err, feature: meta.feature })
  }
  try {
    // A stream that ended without usage still leaves a (zero-cost) row, like a JSON body without it.
    await recordAiUsage(meta, collector.finish() ?? {})
  } catch (err) {
    log.error('ai.usage_parse_failed', { err, feature: meta.feature })
  }
}

/** Streaming chat requests to OpenRouter ask for usage accounting in the final chunk. */
function withStreamUsage(input: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1]): Parameters<typeof fetch>[1] {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (!url.startsWith(OPENROUTER_BASE_URL) || typeof init?.body !== 'string') return init
  try {
    const body = JSON.parse(init.body) as Record<string, unknown>
    if (body.stream !== true || body.usage !== undefined) return init
    return { ...init, body: JSON.stringify({ ...body, usage: { include: true } }) }
  } catch { return init }
}

/**
 * fetch for OpenRouter that records each successful response's cost: JSON
 * bodies from a clone, event streams from a tee'd branch parsed in the
 * background. The caller always reads its own response untouched.
 */
export function meteredFetch(meta: UsageMeta, pending?: Set<Promise<void>>): typeof fetch {
  return async (input, init) => {
    const response = await fetch(input, withStreamUsage(input, init))
    const type = response.headers.get('content-type') ?? ''
    if (response.ok && type.includes('application/json')) {
      // Wait for the record so a request's cost is in the ledger when it ends.
      await response.clone().json().then(body => recordAiUsage(meta, body)).catch(err => {
        log.error('ai.usage_parse_failed', { err, feature: meta.feature })
      })
    } else if (response.ok && type.includes('text/event-stream') && response.body) {
      const metered = response.clone().body
      if (metered) {
        const record: Promise<void> = meterStream(meta, metered).finally(() => pending?.delete(record))
        pending?.add(record)
      }
    }
    return response
  }
}
