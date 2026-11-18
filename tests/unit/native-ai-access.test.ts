import { randomBytes, randomUUID } from 'node:crypto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { encryptApiKey } from '@/lib/crypto'
import { AdminMenuError } from '@/lib/data/admin-menus'
import { insertAiUsageRecord, readTenantAiRecord } from '@/lib/data/ai-access'
const state = vi.hoisted(() => ({ source: vi.fn(), platform: vi.fn(), tenant: vi.fn(), error: vi.fn(), usage: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: state.source }))
vi.mock('@/lib/data/ai-access-runtime', () => ({ readOwnedPlatformAiRecord: state.platform, readOwnedTenantAiRecord: state.tenant, recordOwnedTenantAiKeyError: state.error, insertOwnedAiUsageRecord: state.usage }))
vi.mock('@/lib/observability/context', () => ({ getRequestContext: () => ({ requestId: 'test-request' }) }))
vi.mock('@/lib/observability/log', () => ({ log: { error: vi.fn(), warn: vi.fn() } }))
import { resolveAiAccess, loadPlatformAiSettings, loadTenantAiSettings, meteredFetch, recordAiUsage, runAi, type ResolvedAiAccess } from '@/lib/ai/access'
import { OPENROUTER_BASE_URL } from '@/lib/ai/openrouter'

beforeEach(() => { vi.stubEnv('OWNED_ADMIN_MENUS_ENABLED', 'true'); vi.stubEnv('CHAT_ADDON_ENCRYPTION_KEY', randomBytes(32).toString('hex')) })
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetAllMocks() })
const tenantId = randomUUID()
const choice = () => ({ apiKey: randomUUID(), keySource: 'platform' as const, billable: true, markupPct: 25 })
const meta = () => ({ tenantId, feature: 'chat' as const, choice: choice(), model: 'test/model' })
it('loads and decrypts native settings with the existing defaults/numeric semantics', async () => {
  const platformValue = randomUUID(), tenantValue = randomUUID()
  state.platform.mockResolvedValue({ openrouter_api_key: encryptApiKey(platformValue), default_billing_mode: 'included', default_markup_pct: '35.50', usd_to_brl: '5.75' })
  state.tenant.mockResolvedValue({ openrouter_api_key: encryptApiKey(tenantValue), billing_mode: 'own_key', markup_pct: '12.50', last_key_error: null, last_key_error_at: null })
  expect(await loadPlatformAiSettings()).toEqual({ platformKey: platformValue, platformKeySource: 'panel', defaultMode: 'included', defaultMarkupPct: 35.5, usdToBrl: 5.75 })
  expect(await loadTenantAiSettings(tenantId)).toMatchObject({ key: tenantValue, mode: 'own_key', markupPct: 12.5 })
  expect(state.tenant).toHaveBeenCalledWith(tenantId); expect(state.source).not.toHaveBeenCalled()
})
it('missing native configuration retains explicit environment defaults, while a native read failure refuses source fallback', async () => {
  const value = randomUUID(); vi.stubEnv('OPENROUTER_API_KEY', value); state.platform.mockResolvedValue(null)
  expect(await loadPlatformAiSettings()).toMatchObject({ platformKey: value, platformKeySource: 'env', defaultMode: 'platform', defaultMarkupPct: 30, usdToBrl: 5.5 })
  state.platform.mockRejectedValue(new AdminMenuError(503, 'Unavailable'))
  await expect(loadPlatformAiSettings()).rejects.toMatchObject({ status: 503 }); expect(state.source).not.toHaveBeenCalled()
})
const access = (): ResolvedAiAccess => ({ tenantId, feature: 'chat', primary: { ...choice(), keySource: 'tenant', billable: false, markupPct: 0 }, fallback: choice(), fetchFor: () => fetch, settle: async () => {} })
it('records a native rejected-key warning before the existing billable provider-key fallback', async () => {
  const order: string[] = [], resolved = access()
  state.error.mockImplementation(async () => { order.push('record') })
  const call = vi.fn().mockImplementationOnce(async () => { order.push('primary'); throw Object.assign(new Error('credit exhausted'), { status: 402 }) }).mockImplementationOnce(async () => { order.push('fallback'); return 'response' })
  expect(await runAi(resolved, call)).toBe('response'); expect(order).toEqual(['primary', 'record', 'fallback'])
  expect(state.error).toHaveBeenCalledWith(tenantId, 'HTTP 402: credit exhausted', expect.any(String)); expect(state.source).not.toHaveBeenCalled()
})
it('does not execute a paid fallback after failed native warning persistence', async () => {
  const call = vi.fn().mockRejectedValue({ status: 401 }); state.error.mockRejectedValue(new AdminMenuError(503, 'Unavailable'))
  await expect(runAi(access(), call)).rejects.toMatchObject({ status: 503 }); expect(call).toHaveBeenCalledTimes(1); expect(state.source).not.toHaveBeenCalled()
})
it('writes the existing real-cost/markup arithmetic and fixed ledger projection without invoice fields', async () => {
  const usageMeta = meta(); state.usage.mockResolvedValue(undefined)
  await recordAiUsage(usageMeta, { id: 'generation-test', model: 'returned/model', usage: { cost: 0.01234567 } })
  expect(state.usage).toHaveBeenCalledWith({ tenant_id: tenantId, feature: 'chat', model: 'returned/model', key_source: 'platform', billable: true, cost_usd: 0.01234567, markup_pct: 25, charge_usd: 0.01543209, generation_id: 'generation-test', request_id: 'test-request' })
  const query = vi.fn().mockResolvedValue({ rows: [] }); await insertAiUsageRecord(query, state.usage.mock.calls[0][0])
  expect(query.mock.calls[0][0]).not.toMatch(/invoiced_at|billing_batch|stripe_invoice/); expect(state.source).not.toHaveBeenCalled()
})
it('metering preserves the provider response and never falls back to a source usage insert after SQL failure', async () => {
  state.usage.mockRejectedValue(new AdminMenuError(503, 'Unavailable'))
  const body = { id: 'generation-test', usage: { cost: 0.01 } }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })))
  const response = await meteredFetch(meta(), pendingSet)('http://unit.invalid')
  expect(await response.json()).toEqual(body); expect(state.usage).toHaveBeenCalledTimes(1); expect(state.source).not.toHaveBeenCalled()
})
it('tenant settings use exact bound scope and normalize PostgreSQL timestamps for the existing DTO', async () => {
  const timestamp = new Date(), query = vi.fn().mockResolvedValue({ rows: [{ has_settings: true, billing_mode: 'own_key', last_key_error_at: timestamp }] })
  expect(await readTenantAiRecord(query, tenantId)).toMatchObject({ last_key_error_at: timestamp.toISOString(), is_demo: false })
  expect(query.mock.calls[0][1]).toEqual([tenantId]); expect(query.mock.calls[0][0]).toContain('WHERE t.id=$1')
})
it('a demo company without AI settings still reports itself as a demo; any other client without settings has none', async () => {
  expect(await readTenantAiRecord(vi.fn().mockResolvedValue({ rows: [{ has_settings: false, is_demo: true }] }), tenantId)).toMatchObject({ is_demo: true, billing_mode: null, openrouter_api_key: null })
  expect(await readTenantAiRecord(vi.fn().mockResolvedValue({ rows: [{ has_settings: false, is_demo: false }] }), tenantId)).toBeNull()
  expect(await readTenantAiRecord(vi.fn().mockResolvedValue({ rows: [] }), tenantId)).toBeNull()
})
const pendingSet = new Set<Promise<void>>()
const pending = () => Promise.allSettled([...pendingSet])
const sse = (...chunks: unknown[]) => chunks.map(c => `data: ${typeof c === 'string' ? c : JSON.stringify(c)}\n\n`).join('')
const streamResponse = (text: string) => new Response(new ReadableStream({ start(c) { const enc = new TextEncoder(); for (let i = 0; i < text.length; i += 7) c.enqueue(enc.encode(text.slice(i, i + 7))); c.close() } }), { headers: { 'content-type': 'text/event-stream' } })
it('meters a streamed call once from the last chunk that carries usage, and the caller reads every byte', async () => {
  state.usage.mockResolvedValue(undefined)
  const wire = sse({ id: 'gen-1', model: 'm/x', choices: [{ delta: { content: 'Hi' } }] }, 'not json', { id: 'gen-1', model: 'm/x', choices: [], usage: { cost: 0.002, total_tokens: 9 } }, '[DONE]')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse(wire)))
  const response = await meteredFetch(meta(), pendingSet)('http://unit.invalid')
  expect(await response.text()).toBe(wire)
  await pending()
  expect(state.usage).toHaveBeenCalledTimes(1)
  expect(state.usage.mock.calls[0][0]).toMatchObject({ generation_id: 'gen-1', model: 'm/x', cost_usd: 0.002, markup_pct: 25, charge_usd: 0.0025 })
})
it('a stream without usage records zero cost and does not throw', async () => {
  state.usage.mockResolvedValue(undefined)
  const wire = sse({ id: 'gen-2', choices: [{ delta: { content: 'Hi' } }] }, '[DONE]')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse(wire)))
  expect(await (await meteredFetch(meta(), pendingSet)('http://unit.invalid')).text()).toBe(wire)
  await pending()
  expect(state.usage).toHaveBeenCalledTimes(1)
  expect(state.usage.mock.calls[0][0]).toMatchObject({ cost_usd: 0, charge_usd: 0 })
})
it('asks OpenRouter for usage accounting on streaming chat requests only', async () => {
  const fetchMock = vi.fn().mockImplementation(async () => new Response('{}', { headers: { 'content-type': 'text/plain' } }))
  vi.stubGlobal('fetch', fetchMock)
  const url = `${OPENROUTER_BASE_URL}/chat/completions`
  await meteredFetch(meta())(url, { method: 'POST', body: JSON.stringify({ model: 'm', stream: true }) })
  await meteredFetch(meta())(url, { method: 'POST', body: JSON.stringify({ model: 'm' }) })
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ stream: true, usage: { include: true } })
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ model: 'm' })
})
it('settle() is per access: a slow stream of one guest never delays another guest', async () => {
  state.usage.mockResolvedValue(undefined); state.platform.mockResolvedValue(null); state.tenant.mockResolvedValue(null)
  vi.stubEnv('OPENROUTER_API_KEY', randomUUID())
  const [a, b] = [await resolveAiAccess(tenantId, 'chat'), await resolveAiAccess(tenantId, 'chat')]
  expect(a && b).toBeTruthy()
  const enc = new TextEncoder(); let finishSlow!: () => void
  const slow = new Response(new ReadableStream({ start(c) { c.enqueue(enc.encode(sse({ id: 'slow', choices: [] }))); finishSlow = () => { c.enqueue(enc.encode(sse({ id: 'slow', usage: { cost: 0.01 } }))); c.close() } } }), { headers: { 'content-type': 'text/event-stream' } })
  const fetchMock = vi.fn().mockResolvedValueOnce(slow).mockResolvedValueOnce(streamResponse(sse({ id: 'fast', usage: { cost: 0.001 } }, '[DONE]')))
  vi.stubGlobal('fetch', fetchMock)
  const slowResponse = await a!.fetchFor(a!.primary)('http://unit.invalid')
  const fastResponse = await b!.fetchFor(b!.primary)('http://unit.invalid')
  await fastResponse.text()
  const slowSettled = vi.fn(); void a!.settle().then(slowSettled)
  await b!.settle()
  expect(state.usage).toHaveBeenCalledTimes(1); expect(slowSettled).not.toHaveBeenCalled()
  finishSlow(); await slowResponse.text(); await a!.settle()
  expect(slowSettled).toHaveBeenCalled(); expect(state.usage).toHaveBeenCalledTimes(2)
})
