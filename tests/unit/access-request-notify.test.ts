import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AbandonedDraft, SubmittedLead } from '@/lib/access-requests/store'

const m = vi.hoisted(() => ({ send: vi.fn(), database: vi.fn(), decrypt: vi.fn(), identity: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/blog/telegram', () => ({ sendToAll: m.send }))
vi.mock('@/lib/auth/identity-services', () => ({ getIdentityServices: m.identity }))
vi.mock('@/lib/data/admin-menus-runtime', () => ({ ownedAdminTransaction: m.database }))
vi.mock('@/lib/crypto', () => ({ decryptApiKey: m.decrypt }))

import { notifyAccessRequestSubmitted, notifyAbandonedDraft } from '@/lib/access-requests/notify'

const lead: SubmittedLead = {
  requestId: 'test-request', name: 'Avery <Owner>', accountPhone: '+15085550100',
  answers: { businessName: 'Example Cafe', businessType: 'cafe', contactEmail: 'avery@example.test', interests: ['qr_menu'] },
}
const abandoned: AbandonedDraft = {
  id: 'test-draft', full_name: 'Avery <Owner>', phone: '+15085550100', last_activity_at: null,
  answers: { businessName: 'Example Cafe' }, step: 'contact',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('ACCESS_REQUEST_TELEGRAM_BOT_TOKEN', ' shared-test-bot ')
  vi.stubEnv('ACCESS_REQUEST_TELEGRAM_CHAT_IDS', ' -100987654 ')
  vi.stubEnv('OPS_TELEGRAM_CHAT_ID', '-100123456')
  vi.stubEnv('OPS_TELEGRAM_BOT_TOKEN', 'never-use-ops-token')
  vi.stubEnv('TELEGRAM_BOT_TOKEN', 'never-use-generic-token')
  m.send.mockResolvedValue({ success: true, delivered: 1, failures: [] })
  m.identity.mockReturnValue({ config: { origin: 'https://xprout.app' } })
  m.database.mockImplementation(() => { throw new Error('database must not be read') })
  m.decrypt.mockImplementation(() => { throw new Error('blog credentials must not be decrypted') })
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('dedicated Xprout Leads notifications', () => {
  it('delivers a submitted request using only dedicated configuration and preserves safe content', async () => {
    expect(await notifyAccessRequestSubmitted(lead)).toBe(true)
    expect(m.send).toHaveBeenCalledWith('shared-test-bot', ['-100987654'], expect.stringContaining('NOVO PEDIDO DE ACESSO · XPROUT'))
    const body = m.send.mock.calls[0][2]
    expect(body).toContain('Avery &lt;Owner&gt;')
    expect(body).toContain('Example Cafe')
    expect(body).toContain('https://xprout.app/access-requests')
    expect(body).toContain('https://wa.me/15085550100')
    expect(m.database).not.toHaveBeenCalled()
    expect(m.decrypt).not.toHaveBeenCalled()
  })

  it('routes abandoned drafts to the same dedicated Leads group', async () => {
    expect(await notifyAbandonedDraft(abandoned)).toBe(true)
    expect(m.send).toHaveBeenCalledWith('shared-test-bot', ['-100987654'], expect.stringContaining('CADASTRO ABANDONADO · XPROUT'))
    expect(m.send.mock.calls[0][2]).toContain('Parou em: contato')
    expect(m.database).not.toHaveBeenCalled()
    expect(m.identity).not.toHaveBeenCalled()
  })

  it.each(['development', 'test'])('does not send in %s even with all credentials present', async mode => {
    vi.stubEnv('NODE_ENV', mode)
    expect(await notifyAccessRequestSubmitted(lead)).toBe(false)
    expect(await notifyAbandonedDraft(abandoned)).toBe(false)
    expect(m.send).not.toHaveBeenCalled()
    expect(m.database).not.toHaveBeenCalled()
    expect(m.identity).not.toHaveBeenCalled()
  })

  it.each(['ACCESS_REQUEST_TELEGRAM_BOT_TOKEN', 'ACCESS_REQUEST_TELEGRAM_CHAT_IDS'])('never falls back to Ops, generic or blog credentials when %s is missing', async key => {
    vi.stubEnv(key, ' ')
    expect(await notifyAccessRequestSubmitted(lead)).toBe(false)
    expect(m.send).not.toHaveBeenCalled()
    expect(m.database).not.toHaveBeenCalled()
    expect(m.decrypt).not.toHaveBeenCalled()
    expect(m.identity).not.toHaveBeenCalled()
  })

  it.each(['100987654', '@leads', '-0', '-100987654:0', '-100987654:-2', '-100987654:9007199254740992', '-100123456', '-100123456:42', '-100987654,@other', '-100987654,'])('rejects the whole destination list without IO when a target is invalid or shared with Ops (%s)', async destination => {
    vi.stubEnv('ACCESS_REQUEST_TELEGRAM_CHAT_IDS', destination)
    expect(await notifyAccessRequestSubmitted(lead)).toBe(false)
    expect(m.send).not.toHaveBeenCalled()
    expect(m.database).not.toHaveBeenCalled()
    expect(m.identity).not.toHaveBeenCalled()
  })

  it('preserves explicit valid topics and deduplicates identical configured targets', async () => {
    vi.stubEnv('ACCESS_REQUEST_TELEGRAM_CHAT_IDS', ' -100987654:42, -100765432, -100987654:42 ')
    expect(await notifyAccessRequestSubmitted(lead)).toBe(true)
    expect(m.send).toHaveBeenCalledWith('shared-test-bot', ['-100987654:42', '-100765432'], expect.any(String))
  })

  it('does not require Ops configuration to deliver to Leads', async () => {
    vi.stubEnv('OPS_TELEGRAM_CHAT_ID', '')
    expect(await notifyAccessRequestSubmitted(lead)).toBe(true)
  })

  it('returns false for provider rejection without claiming delivery', async () => {
    m.send.mockResolvedValue({ success: false, delivered: 0, failures: [{ chatId: '-100987654', message: 'not permitted' }] })
    expect(await notifyAccessRequestSubmitted(lead)).toBe(false)
    expect(await notifyAbandonedDraft(abandoned)).toBe(false)
  })

  it('never throws or logs credentials/customer data from a transport exception', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    m.send.mockRejectedValue(new Error('private-token-and-customer'))
    await expect(notifyAccessRequestSubmitted(lead)).resolves.toBe(false)
    await expect(notifyAbandonedDraft(abandoned)).resolves.toBe(false)
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private-token-and-customer')
  })
})
