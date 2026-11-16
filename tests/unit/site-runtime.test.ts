import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn(), legacy: vi.fn(), host: 'xprout.app' }))
vi.mock('@/lib/data/admin-menus-runtime', () => ({ ownedAdminTransaction: mocks.transaction }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: mocks.legacy }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ host: mocks.host }) }))
import { legacySiteTenant, LEGACY_SITE_COLUMNS, loadSiteIdentity, loadTenantSite } from '@/lib/site/runtime'

const row = { id: 't', slug: 'pizza', name: 'Pizza', is_active: true, is_demo: false,
  created_at: '2026-01-01T00:00:00Z', published_at: '2026-01-01T00:00:00Z', custom_domain: null, subdomain: null, language: 'en' }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.host = 'xprout.app'
  vi.stubEnv('OWNED_PUBLIC_MENU_ENABLED', 'true')
  mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.includes('FROM public.tenants') ? [row] : [{ ready: false }] }))
  mocks.transaction.mockImplementation(async (_write: boolean, operation: (q: typeof mocks.query) => Promise<unknown>) => operation(mocks.query))
  mocks.legacy.mockImplementation(() => { throw new Error('Unexpected legacy access') })
})
afterEach(() => vi.unstubAllEnvs())

describe('site identity runtime boundary', () => {
  it('uses the owned read-only transaction without touching Supabase', async () => {
    const site = await loadTenantSite('pizza', '/pizza')
    expect(site).toMatchObject({ indexable: true, canonicalUrl: 'https://xprout.app/pizza' })
    expect(mocks.transaction).toHaveBeenCalledWith(false, expect.any(Function))
    expect(mocks.legacy).not.toHaveBeenCalled()
  })
  it('keeps the request host outside identity data, rejecting an alias on the next request', async () => {
    expect((await loadTenantSite('pizza', '/pizza'))?.indexable).toBe(true)
    mocks.host = 'unknown.example'
    expect((await loadTenantSite('pizza', '/pizza'))?.indexable).toBe(false)
  })
  it('propagates owned failures instead of retrying against stale legacy data', async () => {
    mocks.transaction.mockRejectedValue(new Error('unavailable'))
    await expect(loadSiteIdentity('pizza')).rejects.toThrow('unavailable')
    expect(mocks.legacy).not.toHaveBeenCalled()
  })
  it('rejects invalid slugs before either database is accessed', async () => {
    expect(await loadSiteIdentity("pizza' OR 1=1")).toBeNull()
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.legacy).not.toHaveBeenCalled()
  })
  it('only uses legacy publication compatibility when lifecycle columns are absent', () => {
    expect(legacySiteTenant(row).published_at).toBe(row.created_at)
    expect(legacySiteTenant(row, { published_at: null, is_demo: false }).published_at).toBeNull()
    expect(LEGACY_SITE_COLUMNS).not.toContain('subdomain')
  })
  it('does not mistake a legacy lifecycle outage for an absent migration', async () => {
    vi.stubEnv('OWNED_PUBLIC_MENU_ENABLED', 'false')
    const client = { from: vi.fn((table: string) => {
      let columns = ''
      const chain = { select: (value: string) => { columns = value; return chain }, eq: () => chain,
        maybeSingle: async () => ({ data: table === 'tenants' ? row : null, error: null }),
        single: async () => ({ data: null, error: { code: columns.includes('published_at') ? '08006' : '42703' } }) }
      return chain
    }) }
    mocks.legacy.mockReturnValue(client)
    await expect(loadSiteIdentity('pizza')).rejects.toThrow('publication state is unavailable')
    expect(client.from).not.toHaveBeenCalledWith('brands')
  })
})
