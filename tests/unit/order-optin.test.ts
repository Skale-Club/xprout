import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildOptedInContacts, contactsCsv, csvField, resolveContact, type OptInOrderRow } from '@/lib/orders/order-contact'
import { OwnedOrderRepository } from '@/lib/data/orders'

const TENANT = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const ORDER = 'a1b2c3d4-0000-4000-8000-000000000001'

const row = (extra: Partial<OptInOrderRow> = {}): OptInOrderRow => ({
  tenant_id: TENANT, customer_name: 'Maria', customer_phone: '+1 555 0100', customer_email: 'maria@example.com',
  marketing_sms_opt_in: true, marketing_email_opt_in: true, created_at: '2026-11-10T12:00:00Z', ...extra,
})

describe('resolveContact', () => {
  it('stores nothing marketing-related by default', () => {
    expect(resolveContact({ email: 'a@b.co', phone: '555', language: 'pt' })).toEqual({ email: 'a@b.co', language: 'pt', smsOptIn: false, emailOptIn: false })
  })
  it('an opt-in counts only for a channel the guest gave', () => {
    expect(resolveContact({ phone: '555', email: '', smsOptIn: true, emailOptIn: true })).toMatchObject({ smsOptIn: true, emailOptIn: false })
    expect(resolveContact({ phone: '  ', email: 'a@b.co', smsOptIn: true, emailOptIn: true })).toMatchObject({ smsOptIn: false, emailOptIn: true })
    expect(resolveContact({ phone: '555', email: 'not an email', emailOptIn: true })).toMatchObject({ email: null, emailOptIn: false })
  })
  it('ignores a language the menu does not offer', () => {
    expect(resolveContact({ language: 'xx' }).language).toBeNull()
    expect(resolveContact({ language: 'zh-TW' }).language).toBe('zh-TW')
  })
})

describe('opted-in contacts', () => {
  it('lists a phone only with an SMS opt-in and an email only with an email opt-in', () => {
    const contacts = buildOptedInContacts([
      row(),
      row({ customer_name: 'Sms Only', customer_phone: '+1 555 0111', customer_email: 'smsonly@example.com', marketing_email_opt_in: false }),
      row({ customer_name: 'Mail Only', customer_phone: '+1 555 0122', customer_email: 'mailonly@example.com', marketing_sms_opt_in: false }),
      row({ customer_name: 'Nothing', customer_phone: '+1 555 0133', customer_email: 'no@example.com', marketing_sms_opt_in: false, marketing_email_opt_in: false }),
    ], TENANT)
    expect(contacts.map(c => c.name).sort()).toEqual(['Mail Only', 'Maria', 'Sms Only'])
    const smsOnly = contacts.find(c => c.name === 'Sms Only')!
    expect(smsOnly).toMatchObject({ phone: '+1 555 0111', email: null })
    const mailOnly = contacts.find(c => c.name === 'Mail Only')!
    expect(mailOnly).toMatchObject({ phone: null, email: 'mailonly@example.com' })
    expect(JSON.stringify(contacts)).not.toContain('smsonly@example.com')
    expect(JSON.stringify(contacts)).not.toContain('555 0122')
  })
  it('only this restaurant: rows of another tenant never appear', () => {
    const contacts = buildOptedInContacts([row(), row({ tenant_id: OTHER, customer_name: 'Stranger', customer_phone: '+1 999 0000' })], TENANT)
    expect(contacts.map(c => c.name)).toEqual(['Maria'])
  })
  it('one row per person with the newest name and last order date', () => {
    const contacts = buildOptedInContacts([
      row({ created_at: '2026-11-01T10:00:00Z', customer_name: 'Mari' }),
      row({ created_at: '2026-11-12T10:00:00Z', customer_name: 'Maria', customer_phone: '+1 (555) 0100' }),
    ], TENANT)
    expect(contacts).toHaveLength(1)
    expect(contacts[0]).toMatchObject({ name: 'Maria', lastOrderAt: '2026-11-12T10:00:00Z' })
  })
  it('writes a CSV with the right columns and no formula injection', () => {
    const csv = contactsCsv(buildOptedInContacts([row({ customer_name: '=HYPERLINK("x")' }), row({ customer_name: 'Ana, "A"', customer_phone: '+1 555 0144', customer_email: 'ana@example.com' })], TENANT))
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('name,phone,email,last_order_date')
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csv).toContain('"Ana, ""A""",+1 555 0144,ana@example.com,2026-11-10')
    expect(csvField('+1 555 0100')).toBe('+1 555 0100')
  })
})

describe('schema not applied yet', () => {
  const owned = (ready: boolean, extra: (text: string) => unknown[] = () => []) => {
    const query = vi.fn(async (text: string, _values?: unknown[]) => {
      if (text.includes('information_schema.columns')) return { rows: [{ ready }] }
      return { rows: extra(text) as Record<string, unknown>[] }
    })
    return { query, repo: new OwnedOrderRepository(query, TENANT) }
  }
  it('the export is empty and runs no query against the new columns', async () => {
    const { repo, query } = owned(false)
    expect(await repo.optedInContacts({ tenantId: TENANT, role: 'store-admin' })).toEqual([])
    expect(query.mock.calls.some(([text]) => String(text).includes('FROM public.orders o'))).toBe(false)
  })
  it('claiming an email does nothing, so nothing is sent', async () => {
    const { repo, query } = owned(false)
    expect(await repo.claimEmail(ORDER, 'received')).toBeNull()
    expect(query.mock.calls.every(([text]) => !String(text).includes('UPDATE'))).toBe(true)
  })
  it('the export is tenant-scoped in SQL and refuses another tenant', async () => {
    const { repo, query } = owned(true, text => (text.includes('FROM public.orders o') ? [{ row: row() }, { row: row({ tenant_id: OTHER, customer_name: 'Stranger' }) }] : []))
    const contacts = await repo.optedInContacts({ tenantId: TENANT, role: 'store-admin' })
    expect(contacts.map(c => c.name)).toEqual(['Maria'])
    const select = query.mock.calls.find(([text]) => String(text).includes('FROM public.orders o'))!
    expect(select[0]).toContain('o.tenant_id=$1')
    expect(select[1]).toEqual([TENANT])
    await expect(repo.optedInContacts({ tenantId: OTHER, role: 'store-admin' })).rejects.toMatchObject({ status: 403 })
  })
})

describe('GET /api/admin/orders/contacts-export', () => {
  const effective = vi.fn()
  const select = vi.fn()
  beforeEach(() => {
    vi.resetModules()
    effective.mockReset(); select.mockReset()
    vi.doMock('@/lib/get-effective-tenant', () => ({ getEffectiveTenant: effective }))
    vi.doMock('@/lib/tenant-plan', () => ({ getTenantCapabilities: async () => ({ kds: true }) }))
    vi.doMock('@/lib/observability/with-api', () => ({ withApi: (_n: string, h: unknown) => h }))
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'or', 'order']) builder[m] = (...args: unknown[]) => { select(m, ...args); return builder }
    builder.limit = async () => ({ data: [row(), row({ tenant_id: OTHER, customer_name: 'Stranger' })], error: null })
    vi.doMock('@/lib/supabase/server', () => ({ createServiceClient: async () => ({ from: () => builder }) }))
  })
  it('blocks staff and anonymous callers', async () => {
    const GET = (await import('@/app/api/admin/orders/contacts-export/route')).GET as unknown as () => Promise<Response>
    effective.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
    effective.mockResolvedValue({ tenantId: TENANT, role: 'store-staff' })
    expect((await GET()).status).toBe(403)
  })
  it('serves only the session tenant', async () => {
    const GET = (await import('@/app/api/admin/orders/contacts-export/route')).GET as unknown as () => Promise<Response>
    effective.mockResolvedValue({ tenantId: TENANT, role: 'store-admin' })
    const response = await GET()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/csv')
    const csv = await response.text()
    expect(csv).toContain('Maria')
    expect(csv).not.toContain('Stranger')
    expect(select).toHaveBeenCalledWith('eq', 'tenant_id', TENANT)
  })
})
