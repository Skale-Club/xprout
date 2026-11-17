/**
 * Superadmin › client › AI: billing mode, the client's OpenRouter key, margin
 * override, this month's usage, and actions (test key, bill now).
 */
import { NextResponse } from 'next/server'
import { assertSuperadmin } from '@/lib/superadmin-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { withApi } from '@/lib/observability/with-api'
import { loadPlatformAiSettings, loadTenantAiSettings } from '@/lib/ai/access'
import { billAiUsage } from '@/lib/ai/billing'
import { parseBillingMode, clampMarkup } from '@/lib/ai/billing-rules'
import { maskedOrEmpty, nextStoredKey, startOfMonthIso, unbilledChargeUsd, usageByTenant, verifyOpenRouterKey } from '@/lib/ai/settings-service'
import { adminMenusOwned } from '@/lib/data/admin-menus'
import { adminChatError } from '@/lib/admin/chat-context'
import { assertOwnedAiActor, writeOwnedAiTenantSettings } from '@/lib/data/ai-panel-runtime'
import { nativeAiTenantPayload } from '@/lib/ai/native-panel'
import { chatControls } from '@/lib/data/ai-panel'
import { readNativeAnalyticsBody } from '@/lib/data/public-analytics'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function tenantAiPayload(tenantId: string) {
  const supabase = createServiceClient()
  const [platform, tenant, usage, unbilled, { data: sub }, { data: chatRow }] = await Promise.all([
    loadPlatformAiSettings(),
    loadTenantAiSettings(tenantId),
    usageByTenant(startOfMonthIso(), tenantId),
    unbilledChargeUsd(tenantId),
    supabase.from('tenant_subscriptions').select('stripe_customer_id, chat_addon_override, chat_addon_active, plans(chat_addon_available)').eq('tenant_id', tenantId).maybeSingle(),
    supabase.from('chat_addon_settings').select('enabled, text_enabled, audio_enabled').eq('tenant_id', tenantId).maybeSingle(),
  ])
  const plan = (sub as { plans?: { chat_addon_available?: boolean } | null } | null)?.plans
  return {
    billing_mode: tenant.mode,
    effective_mode: tenant.mode ?? platform.defaultMode,
    openrouter_api_key: maskedOrEmpty(tenant.key),
    markup_pct: tenant.markupPct,
    effective_markup_pct: tenant.markupPct ?? platform.defaultMarkupPct,
    last_key_error: tenant.lastKeyError,
    last_key_error_at: tenant.lastKeyErrorAt,
    global_key_configured: platform.platformKeySource !== 'none',
    usd_to_brl: platform.usdToBrl,
    month: usage.get(tenantId) ?? null,
    unbilled_charge_usd: unbilled,
    can_bill: !!sub?.stripe_customer_id,
    client_key_allowed: tenant.clientKeyAllowed,
    chat: chatControls({ ...(chatRow ?? {}), has_subscription: !!sub, chat_addon_override: sub?.chat_addon_override,
      chat_addon_active: sub?.chat_addon_active, chat_addon_available: plan?.chat_addon_available }),
  }
}

/** Superadmin chat switch and channels (same rules as writeTenantChatControls in src/lib/data/ai-panel.ts). */
async function writeLegacyChat(tenantId: string, input: unknown): Promise<string | null> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'Invalid request'
  const chat = input as Record<string, unknown>, patch: Record<string, unknown> = {}
  if (chat.text !== undefined) { if (typeof chat.text !== 'boolean') return 'Invalid chat channel'; patch.text_enabled = chat.text }
  if (chat.voice !== undefined) { if (typeof chat.voice !== 'boolean') return 'Invalid chat channel'; patch.audio_enabled = chat.voice }
  if (chat.on !== undefined && typeof chat.on !== 'boolean') return 'Invalid chat switch'
  const supabase = createServiceClient()
  const { data: current } = await supabase.from('chat_addon_settings').select('text_enabled, audio_enabled').eq('tenant_id', tenantId).maybeSingle()
  const text = patch.text_enabled ?? current?.text_enabled ?? true, voice = patch.audio_enabled ?? current?.audio_enabled ?? false
  if (text === false && voice === false) return 'Keep text or voice on'
  if (typeof chat.on === 'boolean') {
    const { data, error } = await supabase.from('tenant_subscriptions').update({ chat_addon_override: chat.on }).eq('tenant_id', tenantId).select('tenant_id')
    if (error) return 'Could not save'
    if (!data?.length) return 'This client has no subscription yet'
    patch.enabled = chat.on
  }
  if (!Object.keys(patch).length) return null
  const { error } = await supabase.from('chat_addon_settings').upsert({ tenant_id: tenantId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' })
  return error ? 'Could not save' : null
}

async function handleGET(_request: Request, { params }: Ctx) {
  const authorization = await assertSuperadmin()
  if (!authorization) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  if (adminMenusOwned()) {
    try { return NextResponse.json(await nativeAiTenantPayload({ actorId: authorization.principal.userId, role: 'superadmin', tenantId: id }, true)) }
    catch (error) { return adminChatError(error) }
  }
  return NextResponse.json(await tenantAiPayload(id))
}

async function handlePUT(request: Request, { params }: Ctx) {
  const authorization = await assertSuperadmin()
  if (!authorization) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  if (adminMenusOwned()) {
    try {
      const context = { actorId: authorization.principal.userId, role: 'superadmin' as const, tenantId: id }
      let body: unknown
      try { body = JSON.parse(await readNativeAnalyticsBody(request)) } catch (error) { if (error instanceof SyntaxError) body = {}; else throw error }
      await writeOwnedAiTenantSettings(context, body, false)
      return NextResponse.json(await nativeAiTenantPayload(context, true))
    } catch (error) { return adminChatError(error) }
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  if (body.chat !== undefined) {
    const problem = await writeLegacyChat(id, body.chat)
    if (problem) return NextResponse.json({ error: problem }, { status: problem === 'Could not save' ? 500 : problem.startsWith('This client') ? 409 : 400 })
    // A chat-only change leaves the AI billing row alone.
    if (Object.keys(body).length === 1) return NextResponse.json(await tenantAiPayload(id))
  }
  const row: Record<string, unknown> = { tenant_id: id, updated_at: new Date().toISOString() }

  if (body.billing_mode !== undefined) {
    if (body.billing_mode === null || body.billing_mode === '') row.billing_mode = null
    else {
      const mode = parseBillingMode(body.billing_mode)
      if (!mode) return NextResponse.json({ error: 'Invalid billing mode' }, { status: 400 })
      row.billing_mode = mode
    }
  }
  if (body.markup_pct !== undefined) {
    if (body.markup_pct === null || body.markup_pct === '') row.markup_pct = null
    else {
      const markup = Number(body.markup_pct)
      if (!Number.isFinite(markup) || markup < 0 || markup > 1000) return NextResponse.json({ error: 'Margin must be between 0 and 1000%' }, { status: 400 })
      row.markup_pct = clampMarkup(markup)
    }
  }
  if (body.client_key_allowed !== undefined) {
    if (typeof body.client_key_allowed !== 'boolean') return NextResponse.json({ error: 'Invalid client key permission' }, { status: 400 })
    row.client_key_allowed = body.client_key_allowed
  }
  const key = nextStoredKey(body.openrouter_api_key)
  if (key !== undefined) {
    row.openrouter_api_key = key
    // A new key clears the old failure warning.
    row.last_key_error = null
    row.last_key_error_at = null
  }

  const { error } = await createServiceClient().from('tenant_ai_settings').upsert(row, { onConflict: 'tenant_id' })
  if (error) return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  return NextResponse.json(await tenantAiPayload(id))
}

/** { action: 'test', api_key? } | { action: 'bill' } */
async function handlePOST(request: Request, { params }: Ctx) {
  const authorization = await assertSuperadmin()
  if (!authorization) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  if (adminMenusOwned()) {
    try { await assertOwnedAiActor({ actorId: authorization.principal.userId, role: 'superadmin', tenantId: id }) }
    catch (error) { return adminChatError(error) }
  }
  const body = (await request.json().catch(() => ({}))) as { action?: string; api_key?: string }
  if (body.action === 'test') {
    const candidate = body.api_key?.trim() && !body.api_key.includes('••') ? body.api_key.trim() : (await loadTenantAiSettings(id)).key
    if (!candidate) return NextResponse.json({ ok: false, error: 'This client has no key' })
    return NextResponse.json(await verifyOpenRouterKey(candidate))
  }
  if (body.action === 'bill') {
    try {
      return NextResponse.json(await billAiUsage({ tenantId: id }))
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Billing failed' }, { status: 502 })
    }
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export const GET = withApi('GET /api/superadmin/tenants/[id]/ai', handleGET)
export const PUT = withApi('PUT /api/superadmin/tenants/[id]/ai', handlePUT)
export const POST = withApi('POST /api/superadmin/tenants/[id]/ai', handlePOST)
