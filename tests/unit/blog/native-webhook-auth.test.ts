import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ query: vi.fn(), body: vi.fn(), apply: vi.fn() }))
vi.mock('@/lib/data/admin-menus-runtime', () => ({ ownedAdminTransaction: async (_write: boolean, run: (q: unknown) => Promise<unknown>) => run(mocks.query) }))
vi.mock('@/lib/admin/owned-tenant-administration-http', () => ({ tenantAdminBody: mocks.body }))
vi.mock('@/lib/blog/native/telegram-data', () => ({ applyNativeTelegramDecision: mocks.apply }))
vi.mock('@/lib/blog/native/public-paths', () => ({ revalidateNativeBlogPublic: vi.fn() }))
vi.mock('@/lib/blog/native/telegram', () => ({ dispatchNativeTelegramAck: vi.fn() }))
vi.mock('@/lib/blog/telegram', () => ({ parseApprovalCallbackData: vi.fn(), isChatAllowed: vi.fn() }))

import { nativeBlogTelegramWebhook } from '@/lib/blog/native/telegram-webhook'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.query.mockResolvedValue({ rows: [{ webhook_secret: 'fixture-secret' }] })
  mocks.body.mockResolvedValue({})
})
const request = (secret?: string) => new Request('https://xprout.app/api/internal/blog/telegram-webhook', {
  method: 'POST', headers: secret ? { 'x-telegram-bot-api-secret-token': secret } : {}, body: '{}',
})

it('rejects a missing token before credential lookup or payload parsing', async () => {
  expect((await nativeBlogTelegramWebhook(request())).status).toBe(401)
  expect(mocks.query).not.toHaveBeenCalled()
  expect(mocks.body).not.toHaveBeenCalled()
})
it.each([{ rows: [] }, { rows: [{ webhook_secret: '' }] }, { rows: [{ webhook_secret: 'different-secret' }] }])('rejects unknown, empty and forged credentials before business parsing: %j', async ({ rows }) => {
  mocks.query.mockResolvedValue({ rows })
  expect((await nativeBlogTelegramWebhook(request('fixture-secret'))).status).toBe(401)
  expect(mocks.body).not.toHaveBeenCalled()
  expect(mocks.apply).not.toHaveBeenCalled()
})
it('reads a harmless authenticated update only after matching the configured secret', async () => {
  mocks.body.mockImplementation(async () => {
    expect(mocks.query).toHaveBeenCalledOnce()
    return {}
  })
  expect((await nativeBlogTelegramWebhook(request('fixture-secret'))).status).toBe(200)
  expect(mocks.body).toHaveBeenCalledOnce()
  expect(mocks.apply).not.toHaveBeenCalled()
})
