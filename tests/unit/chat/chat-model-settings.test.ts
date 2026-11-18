import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHAT_MODELS } from '@/lib/ai/chat-models'
import { PLATFORM_AI_BASE_COLUMNS, PLATFORM_CHAT_MODEL_PROBE_SQL, platformAiSelectSql, platformChatModelColumnExists, resetPlatformChatModelProbe, SETTINGS_NOT_AVAILABLE_YET } from '@/lib/data/platform-chat-model'
import { readPlatformAiRecord } from '@/lib/data/ai-access'
import { chatControls, writeAiPlatformSettings, writeAiTenantSettings } from '@/lib/data/ai-panel'
import { writeAdminChatSettings, type AdminChatContext } from '@/lib/data/admin-chat'

const tenantId = randomUUID(), actorId = randomUUID()
const superadmin = { actorId, role: 'superadmin' as const }
const profile = (role = 'superadmin') => ({ id: actorId, role, tenant_id: role === 'superadmin' ? null : tenantId, must_change_password: false, disabled_at: null })
const present = { rows: [{ column_name: 'chat_model' }] }, absent = { rows: [] as unknown[] }
const platformRow = { openrouter_api_key: null, default_billing_mode: 'platform', default_markup_pct: 30, usd_to_brl: 5.5 }
const model = CHAT_MODELS[1].value

beforeEach(() => resetPlatformChatModelProbe())

describe('platform chat model read is probe-gated', () => {
  it('names chat_model only when the column exists', () => {
    expect(platformAiSelectSql(false)).toBe(`SELECT ${PLATFORM_AI_BASE_COLUMNS} FROM public.platform_ai_settings WHERE id=1 LIMIT 2`)
    expect(platformAiSelectSql(true)).toContain(`${PLATFORM_AI_BASE_COLUMNS},chat_model FROM`)
  })
  it('reads without the column before the schema step and with it after', async () => {
    const before = vi.fn().mockResolvedValueOnce(absent).mockResolvedValueOnce({ rows: [platformRow] })
    expect(await readPlatformAiRecord(before)).toMatchObject({ chat_model: null })
    expect(before.mock.calls[0][0]).toBe(PLATFORM_CHAT_MODEL_PROBE_SQL)
    expect(before.mock.calls[1][0]).not.toContain('chat_model')
    const after = vi.fn().mockResolvedValueOnce(present).mockResolvedValueOnce({ rows: [{ ...platformRow, chat_model: model }] })
    expect(await readPlatformAiRecord(after)).toMatchObject({ chat_model: model })
    expect(after.mock.calls[1][0]).toContain('chat_model')
  })
  it('keeps looking while missing and stops once found', async () => {
    const query = vi.fn().mockResolvedValueOnce(absent).mockResolvedValueOnce(present)
    expect(await platformChatModelColumnExists(query)).toBe(false)
    expect(await platformChatModelColumnExists(query)).toBe(true)
    expect(await platformChatModelColumnExists(query)).toBe(true)
    expect(query).toHaveBeenCalledTimes(2)
  })
})

describe('superadmin global default chat model', () => {
  it('rejects a model that is not offered before any write', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [profile()] })
    await expect(writeAiPlatformSettings(query, superadmin, { chat_model: 'openai/gpt-4o-mini' })).rejects.toMatchObject({ status: 400, message: 'Unsupported model' })
    expect(query).toHaveBeenCalledTimes(1)
  })
  it('answers 409 while the column is missing', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [profile()] }).mockResolvedValue(absent)
    await expect(writeAiPlatformSettings(query, superadmin, { chat_model: model })).rejects.toMatchObject({ status: 409, message: SETTINGS_NOT_AVAILABLE_YET })
    expect(query).toHaveBeenCalledTimes(2)
  })
  it('stores an offered id and null (code default)', async () => {
    for (const value of [model, null]) {
      resetPlatformChatModelProbe()
      const query = vi.fn().mockResolvedValueOnce({ rows: [profile()] }).mockResolvedValueOnce(present).mockResolvedValue({ rows: [] })
      await writeAiPlatformSettings(query, superadmin, { chat_model: value })
      const [sql, values] = query.mock.calls[2]
      expect(sql).toContain('chat_model'); expect(values).toContain(value)
    }
  })
  it('a save that does not name the model never probes', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [profile()] }).mockResolvedValue({ rows: [] })
    await writeAiPlatformSettings(query, superadmin, { usd_to_brl: 5.6 })
    expect(query).toHaveBeenCalledTimes(2)
  })
})

describe('superadmin per-restaurant chat model', () => {
  const context = { ...superadmin, tenantId }
  it('exposes the restaurant model only when it is still offered', () => {
    expect(chatControls({ openrouter_model: model }).model).toBe(model)
    expect(chatControls({ openrouter_model: 'openai/gpt-4o-mini' }).model).toBeNull()
    expect(chatControls({ openrouter_model: null }).model).toBeNull()
    expect(chatControls({}).model).toBeNull()
  })
  it('rejects an unlisted model and answers 409 before the schema step', async () => {
    const invalid = vi.fn().mockResolvedValue({ rows: [profile()] })
    await expect(writeAiTenantSettings(invalid, context, { chat: { model: 'x/y' } }, false)).rejects.toMatchObject({ status: 400 })
    const early = vi.fn().mockResolvedValueOnce({ rows: [profile()] }).mockResolvedValue(absent)
    await expect(writeAiTenantSettings(early, context, { chat: { model: null } }, false)).rejects.toMatchObject({ status: 409, message: SETTINGS_NOT_AVAILABLE_YET })
  })
  it('writes an offered id or null to openrouter_model', async () => {
    for (const value of [model, null]) {
      resetPlatformChatModelProbe()
      const query = vi.fn().mockResolvedValueOnce({ rows: [profile()] }).mockResolvedValueOnce(present).mockResolvedValue({ rows: [] })
      await writeAiTenantSettings(query, context, { chat: { model: value } }, false)
      const [sql, values] = query.mock.calls[2]
      expect(sql).toContain('INSERT INTO public.chat_addon_settings'); expect(sql).toContain('openrouter_model'); expect(values).toContain(value)
    }
  })
})

describe('store admin cannot choose the model', () => {
  it('ignores openrouter_model in the write', async () => {
    const owner: AdminChatContext = { actorId, tenantId, role: 'store-admin' }
    const query = vi.fn().mockResolvedValueOnce({ rows: [profile('store-admin')] }).mockResolvedValue({ rows: [] })
    await writeAdminChatSettings(query, owner, { enabled: true, openrouter_model: model })
    const [sql, values] = query.mock.calls[1]
    expect(sql).not.toContain('openrouter_model'); expect(values).not.toContain(model)
  })
})
