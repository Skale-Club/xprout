import { describe, expect, it, vi } from 'vitest'
import { readRequestSite } from '@/lib/site/request-data'
import { anonymousPublicHtml, PRIVATE_HTML_CACHE, PUBLIC_HTML_CACHE } from '@/lib/site/cache-policy'
import { parseRequestSite, serializeRequestSite, siteLocale, type RequestSite } from '@/lib/site/request-contract'
import { lookupRequestSite, type SiteCacheEntry } from '@/lib/site/request-lookup'

const id = '00000000-0000-4000-8000-000000000001'
const restaurant = { id: 'tenant', slug: 'pizza', name: 'Pizza', is_active: true, is_demo: false, published_at: '2026-01-01T00:00:00Z', language: 'pt', brand_id: null }
const defaultBrand = { id, name: 'Xprout', primary_host: 'xprout.app', extra_hosts: [], default_lang: 'en', show_powered_by: true }
function database({ partner = false, apex = false, privateMenu = false } = {}) {
  const brand = partner ? { ...defaultBrand, id: 'partner', name: 'Partner', primary_host: 'partner.example', apex_tenant_id: apex ? 'tenant' : null } : defaultBrand
  return vi.fn(async (sql: string, values?: unknown[]) => {
    if (sql.includes('to_regclass')) return { rows: [{ ready: true }] }
    if (sql.includes('FROM public.brands WHERE primary_host')) return { rows: values?.[0] === brand.primary_host ? [{ id: brand.id }] : [] }
    if (sql.includes('FROM public.brands b')) return { rows: [brand] }
    if (sql.includes('SELECT slug FROM public.tenants WHERE id=')) return { rows: [{ slug: 'pizza' }] }
    if (sql.includes('FROM public.tenants t')) return { rows: values?.[0] === 'pizza' ? [{ ...restaurant, brand_id: partner ? 'partner' : null }] : [] }
    if (sql.includes('FROM public.tenants WHERE custom_domain')) return { rows: [] }
    if (sql.includes('FROM public.menus')) return { rows: [{ id: 'm', slug: 'dinner', is_default: true, is_private: privateMenu }] }
    return { rows: [] }
  })
}

describe('request site and routing snapshot', () => {
  it('resolves language and canonical from the same owned identity', async () => {
    const site = await readRequestSite(database(), 'xprout.app', '/pizza')
    expect(site).toMatchObject({ lang: 'pt', indexable: true, canonicalUrl: 'https://xprout.app/pizza', rewrite: null })
    expect(parseRequestSite(serializeRequestSite(site))).toEqual(site)
  })
  it('does not rewrite payment or identity routes into tenant pages', async () => {
    for (const pathname of ['/api/orders','/auth/login','/checkout/abc','/identity']) {
      expect(await readRequestSite(database(), 'xprout.app', pathname)).toMatchObject({ rewrite: null, indexable: false })
    }
  })
  it('serves partner branding without capturing discovery routes', async () => {
    expect(await readRequestSite(database({ partner: true }), 'partner.example', '/')).toMatchObject({ rewrite: '/brand-site/partner.example', brand: { name: 'Partner' } })
    expect(await readRequestSite(database({ partner: true }), 'partner.example', '/robots.txt')).toMatchObject({ rewrite: null, brand: { name: 'Partner' } })
  })
  it('maps an apex tenant to company pages and canonical brand origin', async () => {
    const site = await readRequestSite(database({ partner: true, apex: true }), 'partner.example', '/')
    expect(site).toMatchObject({ kind: 'brand-apex-tenant', baseUrl: 'https://partner.example', rewrite: '/brand-site/partner.example', lang: 'pt' })
  })
  it('denies unknown hosts and a private menu even when tenant SEO is public', async () => {
    expect((await readRequestSite(database(), 'unknown.example', '/')).indexable).toBe(false)
    expect(await readRequestSite(database({ privateMenu: true }), 'xprout.app', '/pizza')).toMatchObject({ privatePage: true, indexable: false })
  })
  it('rejects malformed authority/path before the database', async () => {
    const query = database()
    await expect(readRequestSite(query, 'https://evil.test', '/')).rejects.toThrow('Invalid')
    await expect(readRequestSite(query, 'xprout.app', '//evil.test')).rejects.toThrow('Invalid')
    expect(query).not.toHaveBeenCalled()
  })
})

describe('anonymous HTML cache boundary', () => {
  const site = { indexable: true, privatePage: false, pathname: '/pizza', tenant: null } as RequestSite
  const request = (url = 'https://xprout.app/pizza', extra: Record<string, string> = {}, method = 'GET') => ({ url, method, headers: new Headers({ accept: 'text/html', ...extra }) })
  it('allows only anonymous cookie-free parameter-free HTML GET', () => {
    expect(anonymousPublicHtml(request(), site)).toBe(true)
    expect(PUBLIC_HTML_CACHE).toContain('s-maxage=60')
    expect(PUBLIC_HTML_CACHE).not.toContain('3153')
    expect(PRIVATE_HTML_CACHE).toBe('private, no-store')
  })
  it.each([{ cookie: 'session=one' }, { cookie: 'session=two' }, { authorization: 'Bearer private' }, { rsc: '1' }, { 'next-router-prefetch': '1' }, { 'next-router-segment-prefetch': '/_tree' }] as Record<string,string>[])('bypasses visitor/RSC state %j', headers => {
    expect(anonymousPublicHtml(request(undefined, headers), site)).toBe(false)
  })
  it.each(['?table=secret','?lang=pt','?view=feed','?utm_source=gbp','?_rsc=one'])('bypasses query %s', query => {
    expect(anonymousPublicHtml(request(`https://xprout.app/pizza${query}`), site)).toBe(false)
  })
  it('never caches personalized/private/preview/error contexts', () => {
    expect(anonymousPublicHtml(request(), { ...site, privatePage: true })).toBe(false)
    expect(anonymousPublicHtml(request(), { ...site, pathname: '/pizza/preview/token' })).toBe(false)
    expect(anonymousPublicHtml(request(), null)).toBe(false)
    expect(anonymousPublicHtml(request(undefined, {}, 'POST'), site)).toBe(false)
  })
})

describe('bounded site context lookup', () => {
  it('caches by host and path and never forwards visitor state', async () => {
    const site = await readRequestSite(database(), 'xprout.app', '/pizza')
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(site))
    const cache = new Map<string, SiteCacheEntry>()
    await lookupRequestSite('xprout.app', '/pizza', cache, fetcher, () => 1)
    await lookupRequestSite('xprout.app', '/pizza', cache, fetcher, () => 2)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: 'no-store' })
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain('session=')
    expect(cache.size).toBe(1)
  })
  it('treats an outage as unavailable, not an indexable default brand', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 503 }))
    const cache = new Map<string, SiteCacheEntry>()
    expect(await lookupRequestSite('xprout.app', '/pizza', cache, fetcher, () => 1)).toBeNull()
    expect(cache.values().next().value?.expires).toBe(5001)
  })
  it('normalizes supported OG locales and rejects unbounded context', () => {
    expect(siteLocale('en')).toBe('en_US')
    expect(siteLocale('pt-BR')).toBe('pt_BR')
    expect(parseRequestSite('a'.repeat(12001))).toBeNull()
  })
})
