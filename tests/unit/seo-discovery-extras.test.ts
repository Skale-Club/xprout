import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { discoveryExtraEntries, llmsText, readDiscoveryExtras } from '@/lib/site/discovery-extras'
import { indexNowKey, publishUrls, runPublishEffects } from '@/lib/site/publish-effects'
import { resolveSite } from '@/lib/site/resolve-site'

const mocks = vi.hoisted(() => ({ site: vi.fn(), after: vi.fn(), transaction: vi.fn(), mutation: vi.fn() }))
vi.mock('@/lib/site/request-runtime', () => ({ requestSite: mocks.site }))
vi.mock('next/server', () => ({ after: mocks.after }))
vi.mock('@/lib/data/admin-menus-runtime', () => ({ ownedAdminTransaction: mocks.transaction }))
vi.mock('@/lib/data/admin-products', () => ({ mutateAdminProduct: mocks.mutation, readProductsPage: vi.fn() }))
import { GET as keyProof } from '@/app/indexnow-key.txt/route'
import { mutateOwnedProduct } from '@/lib/data/admin-products-runtime'

const tenantId = '11111111-1111-4111-8111-111111111111'
const now = Date.parse('2026-11-16T12:00:00Z')
const tenant = { id: tenantId, slug: 'pizza', name: 'Pizza', is_active: true, is_demo: false, published_at: '2026-01-01T00:00:00Z' }
const site = resolveSite({ host: 'xprout.app', pathname: '/pizza', tenant, platformOrigin: 'https://xprout.app', subdomainBase: null, now })
const dish = { id: tenantId, name: 'Soup', description: 'Roasted tomato soup.', image_url: '/soup.webp', price: '12.00', tags: [], is_available: true, menu_slug: 'dinner', is_private: false, menu_active: true }
const production = { NODE_ENV: 'production', INDEXNOW_ENABLED: 'true', INDEXNOW_KEY: 'abcdefgh1234', CLOUDFLARE_PURGE_ENABLED: 'true', CLOUDFLARE_API_TOKEN: 'test-token', CLOUDFLARE_ZONE_ID: 'a'.repeat(32) }

beforeEach(() => { vi.clearAllMocks(); mocks.site.mockResolvedValue(site) })
afterEach(() => vi.unstubAllEnvs())

describe('tenant sitemap extras use the public catalog and entitled published blog', () => {
  it('adds named default-menu dish URLs, live posts, tags and date archives', () => {
    const entries = discoveryExtraEntries(site.baseUrl, [dish], [
      { slug: 'welcome', tags: 'Local food, Pizza', published_at: '2026-11-01T00:00:00Z' },
      { slug: 'future', published_at: '2027-01-01T00:00:00Z' },
    ], true, now)
    expect(entries.map(entry => entry.url)).toEqual(expect.arrayContaining([
      'https://xprout.app/pizza/dinner/soup-111111111111', 'https://xprout.app/pizza/blog/welcome',
      'https://xprout.app/pizza/blog/tag/local-food', 'https://xprout.app/pizza/blog/archive/2026/11',
    ]))
    expect(entries.some(entry => entry.url.includes('future'))).toBe(false)
  })
  it('does not list private, inactive, unavailable or incomplete dishes or unentitled blog', () => {
    const entries = discoveryExtraEntries(site.baseUrl, [
      { ...dish, is_private: true }, { ...dish, menu_active: false }, { ...dish, is_available: false }, { ...dish, description: '' },
    ], [{ slug: 'hidden', published_at: '2026-01-01T00:00:00Z' }], false, now)
    expect(entries).toEqual([])
  })
  it('reads only this tenant, caps queries and checks blog capability before reading posts', async () => {
    const query = vi.fn(async (sql: string, _values?: unknown[]) => ({ rows: sql.includes('public.products') ? [dish] : [{ status: 'active', features: [] }] }))
    await readDiscoveryExtras(query, tenantId, site.baseUrl)
    expect(query.mock.calls).toHaveLength(2)
    for (const [sql, values] of query.mock.calls) { expect(sql).toContain('tenant_id=$1'); expect(values).toEqual([tenantId]) }
    expect(query.mock.calls[0][0]).toContain('LIMIT 4000')
    expect(query.mock.calls[0][0]).toContain('m.is_private=false')
  })
})

describe('per-site llms text', () => {
  it('uses factual tenant identity and canonical tenant links without platform promotion', () => {
    const text = llmsText(site, { address: '10 Main', city: 'New York', phone: '555', business_hours: { mon: '09:00–22:00' } }, [
      { title: 'Dinner', href: `${site.baseUrl}/dinner` }, { title: 'Other tenant', href: 'https://xprout.app/other' },
    ])
    expect(text).toContain('# Pizza')
    expect(text).toContain('Address: 10 Main, New York')
    expect(text).toContain(`${site.baseUrl}/dinner`)
    expect(text).not.toContain('Other tenant')
    expect(text).not.toContain('/pricing')
  })
  it('omits nonindexable sites and provides only official links for a brand', () => {
    expect(llmsText({ ...site, indexable: false })).toBe('')
    const brand = resolveSite({ host: 'xprout.app', pathname: '/', tenant: null, platformOrigin: 'https://xprout.app' })
    expect(llmsText(brand)).toContain('https://xprout.app/pricing')
    expect(llmsText(brand)).not.toContain('Address:')
  })
})

describe('optional production publication effects', () => {
  it('never calls an external service in development, even with configured credentials', async () => {
    const fetcher = vi.fn()
    expect(await runPublishEffects(site, ['/dinner'], { ...production, NODE_ENV: 'development' }, fetcher)).toEqual({ indexnow: 'disabled', cloudflare: 'disabled' })
    expect(fetcher).not.toHaveBeenCalled()
    expect(indexNowKey({ ...production, NODE_ENV: 'development' })).toBeNull()
  })
  it('uses the official POST payload, keyLocation and bounded per-URL cache purge', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ success: true }), { status: 200 }))
    expect(await runPublishEffects(site, ['/dinner'], production, fetcher)).toEqual({ indexnow: 'submitted', cloudflare: 'purged' })
    const [indexUrl, indexOptions] = fetcher.mock.calls[0]
    expect(indexUrl).toBe('https://api.indexnow.org/indexnow')
    expect(indexOptions?.method).toBe('POST')
    expect(JSON.parse(String(indexOptions?.body))).toMatchObject({ host: 'xprout.app', keyLocation: 'https://xprout.app/indexnow-key.txt', urlList: expect.arrayContaining([`${site.baseUrl}/dinner`]) })
    expect(String(fetcher.mock.calls[1][0])).toContain('/purge_cache')
  })
  it('fails softly without leaking provider response bodies or starting retries', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('provider error', { status: 503 }))
    expect(await runPublishEffects(site, [], production, fetcher)).toEqual({ indexnow: 'failed', cloudflare: 'failed' })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('does not notify IndexNow for a noindex site or any service for a preview', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ success: true })))
    await runPublishEffects({ ...site, indexable: false, reason: 'seo-noindex' }, [], production, fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)
    fetcher.mockClear()
    await runPublishEffects({ ...site, indexable: false, reason: 'preview' }, [], production, fetcher)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('rejects credential, private, cross-tenant traversal and arbitrary query paths', () => {
    const urls = publishUrls(site, ['/dinner', '/api/secret', '/../other', '/%2e%2e/other', '//evil.com', '/menu?table=1'])
    expect(urls).toHaveLength(4)
    expect(urls).toContain(`${site.baseUrl}/dinner`)
  })
  it('publishes proof only on a canonical indexable production host', async () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('INDEXNOW_ENABLED', 'true'); vi.stubEnv('INDEXNOW_KEY', 'abcdefgh1234')
    expect(await (await keyProof()).text()).toBe('abcdefgh1234')
    mocks.site.mockResolvedValue({ ...site, indexable: false })
    expect((await keyProof()).status).toBe(404)
    vi.stubEnv('NODE_ENV', 'development')
    expect((await keyProof()).status).toBe(404)
  })
  it('registers post-response work only after a committed mutation, never on rejection', async () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('INDEXNOW_ENABLED', 'true'); vi.stubEnv('INDEXNOW_KEY', 'abcdefgh1234')
    mocks.transaction.mockRejectedValueOnce(new Error('ROLLBACK'))
    await expect(mutateOwnedProduct({ tenantId, role: 'store-admin' }, { kind: 'delete', id: tenantId })).rejects.toThrow('ROLLBACK')
    expect(mocks.after).not.toHaveBeenCalled()
    mocks.transaction.mockResolvedValueOnce({ ok: true })
    await mutateOwnedProduct({ tenantId, role: 'store-admin' }, { kind: 'delete', id: tenantId })
    expect(mocks.after).toHaveBeenCalledOnce()
  })
})
