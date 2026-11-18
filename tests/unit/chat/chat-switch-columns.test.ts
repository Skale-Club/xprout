import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHAT_SWITCH_COLUMNS, chatSelectColumns, presentChatSwitchColumns, presentChatSwitchColumnsFor, resetChatSwitchProbe, switchOn } from '@/lib/data/chat-switch-columns'
import { chatSettingsSql } from '@/lib/data/public-menu'
import { createPublicChatSession } from '@/lib/data/public-chat-session'
import { readAdminChatSettings, writeAdminChatSettings, type AdminChatContext } from '@/lib/data/admin-chat'
import { hashPhone } from '@/lib/crypto'

beforeEach(() => resetChatSwitchProbe())

describe('probe helper', () => {
  it('names only the columns that exist and treats absent switches as on', async () => {
    const present = await presentChatSwitchColumns(async () => ['history_enabled'])
    expect([...present]).toEqual(['history_enabled'])
    expect(chatSelectColumns('a,b', present)).toBe('a,b,history_enabled')
    expect(chatSelectColumns('a,b', new Set())).toBe('a,b')
    expect(chatSelectColumns('a', present, ['ordering_help_enabled'])).toBe('a')
    expect(switchOn(undefined)).toBe(true)
    expect(switchOn(null)).toBe(true)
    expect(switchOn(false)).toBe(false)
  })
  it('re-probes while a column is missing and stops once every column was seen', async () => {
    const fetchPresent = vi.fn(async () => [] as string[])
    await presentChatSwitchColumns(fetchPresent)
    await presentChatSwitchColumns(fetchPresent)
    expect(fetchPresent).toHaveBeenCalledTimes(2) // a negative result is never cached
    fetchPresent.mockResolvedValue([...CHAT_SWITCH_COLUMNS])
    expect((await presentChatSwitchColumns(fetchPresent)).size).toBe(CHAT_SWITCH_COLUMNS.length)
    expect((await presentChatSwitchColumns(fetchPresent)).size).toBe(CHAT_SWITCH_COLUMNS.length)
    expect(fetchPresent).toHaveBeenCalledTimes(3) // positive: remembered
  })
  it('keeps a column found earlier even if a later probe lists fewer', async () => {
    await presentChatSwitchColumns(async () => ['suggestions_enabled'])
    expect((await presentChatSwitchColumns(async () => ['history_enabled'])).size).toBe(2)
  })
  it('probes with a plain query', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ column_name: 'staff_call_enabled' }] })
    expect([...(await presentChatSwitchColumnsFor(query))]).toEqual(['staff_call_enabled'])
    expect(query.mock.calls[0][0]).toContain('information_schema.columns')
    expect(query.mock.calls[0][1]).toEqual([CHAT_SWITCH_COLUMNS])
  })
})

describe('public menu chat settings SQL', () => {
  it('omits the keys until the columns exist', () => {
    expect(chatSettingsSql(new Set())).not.toMatch(/suggestions_enabled|history_enabled/)
    const sql = chatSettingsSql(new Set(['suggestions_enabled', 'history_enabled'] as const))
    expect(sql).toContain("'suggestions_enabled', suggestions_enabled")
    expect(sql).toContain("'history_enabled', history_enabled")
    expect(chatSettingsSql(new Set(['history_enabled'] as const))).not.toContain('suggestions_enabled')
  })
})

describe('session creation without history', () => {
  const tenantId = randomUUID(), conversationId = randomUUID(), phone = '+1 (202) 555-0101'
  const base = (probe: unknown[], historyRow: unknown[]) => vi.fn()
    .mockResolvedValueOnce({ rows: [{ id: tenantId }] })
    .mockResolvedValueOnce({ rows: [{ chat_addon_available: true, chat_addon_active: true, chat_addon_override: null }] })
    .mockResolvedValueOnce({ rows: [{ enabled: true, rate_limit_per_phone_per_day: 20 }] })
    .mockResolvedValueOnce({ rows: [] }) // advisory lock
    .mockResolvedValueOnce({ rows: [] }) // blocklist
    .mockResolvedValueOnce({ rows: probe })
    .mockResolvedValueOnce({ rows: historyRow })
  it('always inserts a new conversation and counts the phone allowance', async () => {
    const query = base([{ column_name: 'history_enabled' }], [{ history_enabled: false }])
      .mockResolvedValueOnce({ rows: [{ id: conversationId }] })
      .mockResolvedValueOnce({ rows: [{ used: 4 }] })
    const result = await createPublicChatSession(query, 'restaurant', phone, new Date('2026-11-04T12:00:00Z'))
    expect(result).toEqual({ conversation_id: conversationId, rate_limit: 20, messages_today: 4 })
    const sqls = query.mock.calls.map(call => String(call[0]))
    expect(sqls.some(sql => /FROM public\.chat_conversations\s+WHERE tenant_id=\$1 AND phone_hash=\$2 AND started_at/.test(sql))).toBe(false)
    expect(query.mock.calls[query.mock.calls.length - 1][1]).toEqual([tenantId, hashPhone('12025550101', tenantId), '2026-11-03T12:00:00.000Z'])
  })
  it('keeps reusing the conversation when the switch is on or the column is missing', async () => {
    for (const [probe, historyRow] of [[[{ column_name: 'history_enabled' }], [{ history_enabled: true }]], [[], []]] as const) {
      resetChatSwitchProbe()
      const query = base([...probe], [...historyRow])
      // With the column missing there is no settings read: the next mocked answer is the conversation lookup.
      if (probe.length === 0) query.mockReset().mockResolvedValueOnce({ rows: [{ id: tenantId }] })
        .mockResolvedValueOnce({ rows: [{ chat_addon_available: true, chat_addon_active: true, chat_addon_override: null }] })
        .mockResolvedValueOnce({ rows: [{ enabled: true }] }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] })
      query.mockResolvedValueOnce({ rows: [{ id: conversationId, message_count: 6 }] })
      expect((await createPublicChatSession(query, 'restaurant', phone)).conversation_id).toBe(conversationId)
    }
  })
})

describe('admin settings with the columns missing', () => {
  const tenantId = randomUUID(), actorId = randomUUID(), context: AdminChatContext = { tenantId, actorId, role: 'store-admin' }
  const profile = { id: actorId, role: 'store-admin', tenant_id: tenantId, must_change_password: false, disabled_at: null }
  it('reads the switch columns only when they exist', async () => {
    for (const [probe, expected] of [[[], false], [[{ column_name: 'history_enabled' }], true]] as const) {
      resetChatSwitchProbe()
      const query = vi.fn().mockResolvedValueOnce({ rows: [profile] }).mockResolvedValueOnce({ rows: [...probe] }).mockResolvedValueOnce({ rows: [{ enabled: true }] }).mockResolvedValue({ rows: [] })
      await readAdminChatSettings(query, context)
      expect(String(query.mock.calls[2][0]).includes('history_enabled')).toBe(expected)
    }
  })
  it('answers 409 instead of failing when a switch is saved before the schema step', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [profile] }).mockResolvedValueOnce({ rows: [] })
    await expect(writeAdminChatSettings(query, context, { history_enabled: false })).rejects.toMatchObject({ status: 409, message: 'Settings not available yet, try again in a few minutes' })
    expect(query).toHaveBeenCalledTimes(2) // nothing was written
  })
  it('saves the switch once the column exists', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [profile] }).mockResolvedValueOnce({ rows: CHAT_SWITCH_COLUMNS.map(column_name => ({ column_name })) }).mockResolvedValue({ rows: [] })
    await writeAdminChatSettings(query, context, { history_enabled: false, staff_call_enabled: true })
    expect(String(query.mock.calls[2][0])).toContain('history_enabled')
    expect(query.mock.calls[2][1]).toContain(false)
  })
})
