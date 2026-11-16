import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveSite, type SiteTenant } from '@/lib/site/resolve-site'
import { readSeoTenant, readSiteBrand, readTenantSitemapEntries } from '@/lib/data/public-seo'

const mocks = vi.hoisted(() => ({ identity: vi.fn(), brand: vi.fn(), sitemap: vi.fn(), tenants: vi.fn(), pages: vi.fn() }))
vi.mock('@/lib/site/runtime', () => ({ loadSiteIdentity: mocks.identity, loadSiteBrand: mocks.brand }))
vi.mock('@/lib/data/owned-mode', () => ({ ownedModeActive: () => true }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => { throw new Error('No legacy fallback') } }))
vi.mock('@/lib/data/public-seo-runtime', () => ({ ownedTenantSitemap: mocks.sitemap, ownedSitemapTenants: mocks.tenants }))
vi.mock('@/lib/data/tenant-pages-runtime', () => ({ ownedPublishedPageEntries: mocks.pages }))
import { GET as robots } from '@/app/(public)/[slug]/robots.txt/route'
import { GET as sitemap } from '@/app/(public)/[slug]/sitemap.xml/route'
import { GET as sitemapIndex } from '@/app/sitemap.xml/route'

const tenant: SiteTenant & { id: string; updated_at: string } = {
  id: 'restaurant', slug: 'pizza', name: 'Pizza', is_active: true, is_demo: false,
  published_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', tenant_settings: { language: 'en', seo_noindex: false },
}
const params = { params: Promise.resolve({ slug: tenant.slug }) }
const request = (file: string, host = 'xprout.app') => new Request(`https://${host}/pizza/${file}`, { headers: { host } })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.identity.mockResolvedValue({ tenant })
  mocks.brand.mockResolvedValue(undefined)
  mocks.sitemap.mockResolvedValue({ tenant, menus: [{ slug: 'drinks', is_default: false }], locations: [], rootIsPublic: true })
  mocks.tenants.mockResolvedValue([tenant])
  mocks.pages.mockResolvedValue([])
})

describe('shared discovery gate', () => {
  it('keeps metadata, robots and sitemap index consistent for a public tenant', async () => {
    expect(resolveSite({ host: 'xprout.app', pathname: '/pizza', tenant }).indexable).toBe(true)
    const robot = await robots(request('robots.txt'), params)
    expect(robot.status).toBe(200)
    expect(await robot.text()).toContain('Sitemap: https://xprout.app/pizza/sitemap.xml')
    const map = await sitemap(request('sitemap.xml'), params)
    expect(map.status).toBe(200)
    expect(await map.text()).toContain('https://xprout.app/pizza/drinks</loc>')
    const index = await sitemapIndex(new Request('https://xprout.app/sitemap.xml'))
    expect(await index.text()).toContain('https://xprout.app/pizza/sitemap.xml</loc>')
  })
  it.each([
    { is_demo: true }, { is_active: false }, { published_at: null },
    { tenant_settings: { seo_noindex: true } }, { brand_id: 'another-brand' },
  ])('excludes %j from every discovery path', async flags => {
    const hidden = { ...tenant, ...flags }
    mocks.identity.mockResolvedValue({ tenant: hidden })
    mocks.sitemap.mockResolvedValue({ tenant: hidden, menus: [], locations: [] })
    mocks.tenants.mockResolvedValue([hidden])
    const robot = await robots(request('robots.txt'), params)
    expect(await robot.text()).toBe('User-agent: *\nDisallow: /\n')
    const map = await sitemap(request('sitemap.xml'), params)
    expect(map.status).toBe(404)
    expect(map.headers.get('x-robots-tag')).toBe('noindex')
    const index = await sitemapIndex(new Request('https://xprout.app/sitemap.xml'))
    expect(await index.text()).not.toContain('/pizza/sitemap.xml')
  })
  it('indexes a verified own domain and denies the platform duplicate', async () => {
    const owned = { ...tenant, custom_domain: 'pizza.example', custom_domain_verified: true }
    mocks.identity.mockResolvedValue({ tenant: owned })
    mocks.sitemap.mockResolvedValue({ tenant: owned, menus: [], locations: [], rootIsPublic: true })
    const own = await robots(request('robots.txt', 'pizza.example'), params)
    expect(await own.text()).toContain('https://pizza.example/sitemap.xml')
    expect((await sitemap(request('sitemap.xml', 'pizza.example'), params)).status).toBe(200)
    expect(await (await robots(request('robots.txt'), params)).text()).not.toContain('Sitemap:')
    expect((await sitemap(request('sitemap.xml'), params)).status).toBe(404)
  })
  it('handles a missing restaurant without dereferencing null', async () => {
    mocks.identity.mockResolvedValue(null)
    expect((await robots(request('robots.txt'), params)).status).toBe(404)
  })
  it('answers transient identity failures with 503 and retry, without a wrong robots policy', async () => {
    mocks.identity.mockRejectedValue(new Error('database unavailable'))
    const response = await robots(request('robots.txt'), params)
    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('300')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.text()).not.toContain('Disallow')
  })
  it('does not emit a sitemap on arbitrary or staging hosts', async () => {
    for (const host of ['unknown.example', 'staging.xprout.app']) {
      expect((await sitemapIndex(new Request(`https://${host}/sitemap.xml`))).status).toBe(404)
      expect((await sitemap(request('sitemap.xml', host), params)).status).toBe(404)
    }
  })
})

describe('SEO identity data boundary', () => {
  it('reads publication and preference explicitly with a bound slug', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ ...tenant, language: 'pt-BR', seo_noindex: true, subdomain: 'pizza' }] })
    const actual = await readSeoTenant(query, 'pizza')
    expect(actual).toMatchObject({ is_active: true, is_demo: false, published_at: tenant.published_at,
      subdomain: 'pizza', tenant_settings: { language: 'pt-BR', seo_noindex: true } })
    expect(query.mock.calls[0][1]).toEqual(['pizza'])
    expect(query.mock.calls[0][0]).toContain("WHEN to_jsonb(t) ? 'published_at'")
    expect(await readSeoTenant(query, "pizza' OR true")).toBeNull()
    expect(query).toHaveBeenCalledTimes(1)
  })
  it('never replaces an assigned unavailable brand with Xprout', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ ready: false }] })
    expect(await readSiteBrand(query)).toBeUndefined()
    await expect(readSiteBrand(query, 'assigned-brand')).rejects.toThrow('unavailable')
  })
  it('keeps private menus out of the entries without reading nonexistent menu dates', async () => {
    const query = vi.fn(async (text: string) => { void text; return { rows: [] } })
    await readTenantSitemapEntries(query, 'restaurant')
    const sql = query.mock.calls[0][0]
    expect(sql).not.toContain('updated_at')
    expect(sql).toContain('is_private')
  })
  it('omits a private default root and private branches while keeping public menus', async () => {
    const query = vi.fn(async (text: string) => ({ rows: text.includes('FROM public.menus')
      ? [{ id: 'private', slug: 'secret', is_default: true, is_private: true }, { id: 'public', slug: 'drinks', is_default: false, is_private: false }]
      : [{ slug: 'private-branch', menu_id: 'private' }] }))
    const entries = await readTenantSitemapEntries(query, 'restaurant')
    expect(entries.rootIsPublic).toBe(false)
    expect(entries.locations).toEqual([])
    expect(entries.menus).toEqual([{ slug: 'drinks', is_default: false }])
  })
})
