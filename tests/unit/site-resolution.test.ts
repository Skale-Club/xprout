import { afterEach, describe, expect, it, vi } from 'vitest'
import { indexability, siteRobots, siteRobotsText } from '@/lib/site/indexability'
import { normalizeSiteHost, resolveSite, type ResolveSiteInput, type SiteBrand, type SiteTenant } from '@/lib/site/resolve-site'

const now = Date.parse('2026-11-16T12:00:00Z')
const tenant: SiteTenant = {
  slug: 'pizza', name: 'Pizza', is_active: true, is_demo: false,
  published_at: '2026-01-01T00:00:00Z', tenant_settings: { language: 'pt-BR', seo_noindex: false },
}
const partner: SiteBrand = {
  id: 'partner', name: 'Partner', primary_host: 'partner.com', extra_hosts: ['www.partner.com'], default_lang: 'es',
}
const resolve = (input: Partial<ResolveSiteInput> = {}) => resolveSite({
  host: 'xprout.app', pathname: '/', tenant: null,
  platformOrigin: 'https://xprout.app', now, ...input,
})

afterEach(() => vi.unstubAllEnvs())

describe('site resolution across six host modes', () => {
  const cases: Array<[string, Partial<ResolveSiteInput>, object]> = [
    ['platform brand', {}, { origin: 'https://xprout.app', canonicalUrl: 'https://xprout.app', kind: 'brand', lang: 'en' }],
    ['slug tenant', { tenant, pathname: '/pizza/drinks' }, { origin: 'https://xprout.app', baseUrl: 'https://xprout.app/pizza', canonicalUrl: 'https://xprout.app/pizza/drinks', kind: 'tenant-path', lang: 'pt-BR' }],
    ['subdomain tenant', { tenant: { ...tenant, subdomain: 'pizza' }, host: 'pizza.xprout.app', subdomainBase: 'xprout.app', pathname: '/drinks' }, { origin: 'https://pizza.xprout.app', canonicalUrl: 'https://pizza.xprout.app/drinks', kind: 'tenant-subdomain', lang: 'pt-BR' }],
    ['custom-domain tenant', { tenant: { ...tenant, custom_domain: 'pizza.com', custom_domain_verified: true }, host: 'pizza.com', pathname: '/drinks' }, { origin: 'https://pizza.com', canonicalUrl: 'https://pizza.com/drinks', kind: 'tenant-domain', lang: 'pt-BR' }],
    ['partner brand', { brand: partner, host: 'partner.com' }, { origin: 'https://partner.com', canonicalUrl: 'https://partner.com', kind: 'brand', lang: 'es' }],
    ['partner tenant', { brand: partner, host: 'partner.com', pathname: '/pizza', tenant: { ...tenant, brand_id: partner.id } }, { origin: 'https://partner.com', canonicalUrl: 'https://partner.com/pizza', kind: 'tenant-path', lang: 'pt-BR' }],
  ]
  it.each(cases)('%s shares canonical and discovery identity', (_name, input, expected) => {
    const site = resolve(input)
    expect(site).toMatchObject({ ...expected, indexable: true, reason: 'indexable' })
    expect(siteRobots(site)).toEqual({ index: true, follow: true })
    expect(siteRobotsText(site)).toBe(`User-agent: *\nAllow: /\nSitemap: ${site.baseUrl}/sitemap.xml\n`)
  })
})

describe('canonical host boundaries', () => {
  it('uses the configured subdomain base when omitted and allows explicit disabling', () => {
    vi.stubEnv('TENANT_SUBDOMAIN_BASE', 'xprout.app')
    const input = { tenant: { ...tenant, subdomain: 'pizza' }, host: 'pizza.xprout.app' }
    expect(resolve(input)).toMatchObject({ canonicalUrl: 'https://pizza.xprout.app', indexable: true })
    expect(resolve({ ...input, subdomainBase: null })).toMatchObject({ canonicalUrl: 'https://xprout.app/pizza', indexable: false })
  })
  it.each(['www.xprout.app', 'unknown.com', 'xmartmenu.skale.club'])('does not index brand aliases or unknown host %s', host => {
    expect(resolve({ host })).toMatchObject({ indexable: false, canonicalUrl: 'https://xprout.app' })
  })
  it('does not index a partner alias', () => {
    expect(resolve({ host: 'www.partner.com', brand: partner }).indexable).toBe(false)
  })
  it('keeps the verified custom domain ahead of a subdomain and slug copy', () => {
    const owned = { ...tenant, subdomain: 'pizza', custom_domain: 'pizza.com', custom_domain_verified: true }
    for (const host of ['xprout.app', 'pizza.xprout.app']) {
      const site = resolve({ host, tenant: owned, pathname: '/pizza/drinks', subdomainBase: 'xprout.app' })
      expect(site.canonicalUrl).toBe('https://pizza.com/drinks')
      expect(site.indexable).toBe(false)
    }
  })
  it('never trusts an unverified or malformed custom domain', () => {
    for (const custom_domain of ['pizza.com', 'https://evil.com', 'pizza.com@evil.com']) {
      const site = resolve({ tenant: { ...tenant, custom_domain, custom_domain_verified: custom_domain !== 'pizza.com' }, pathname: '/pizza' })
      expect(site.canonicalUrl).toBe('https://xprout.app/pizza')
    }
  })
  it('does not turn the brand root into the supplied path tenant', () => {
    expect(resolve({ tenant }).indexable).toBe(false)
  })
  it('indexes a public menu named menu on both platform and own-domain paths', () => {
    expect(resolve({ tenant, pathname: '/pizza/menu' }).indexable).toBe(true)
    expect(resolve({ tenant: { ...tenant, custom_domain: 'pizza.com', custom_domain_verified: true }, host: 'pizza.com', pathname: '/menu' }).indexable).toBe(true)
  })
  it('rejects a tenant assigned to another or unavailable brand', () => {
    expect(resolve({ tenant: { ...tenant, brand_id: 'missing-brand' }, pathname: '/pizza' })).toMatchObject({ indexable: false, reason: 'brand-mismatch' })
  })
})

describe('shared fail-closed indexability', () => {
  const gate = (extra: Partial<Parameters<typeof indexability>[0]> = {}) => indexability({
    tenantSlug: tenant.slug, isActive: true, isDemo: false, publishedAt: tenant.published_at,
    canonicalHost: true, pathname: '/pizza', now, ...extra,
  })
  it.each([
    [{ isActive: false }, 'inactive'], [{ isActive: undefined }, 'inactive'],
    [{ publishedAt: null }, 'unpublished'], [{ publishedAt: 'bad' }, 'unpublished'],
    [{ publishedAt: '2027-01-01T00:00:00Z' }, 'unpublished'],
    [{ isDemo: true }, 'demo'], [{ isDemo: undefined }, 'demo'],
    [{ seoNoindex: true }, 'seo-noindex'], [{ preview: true }, 'preview'],
    [{ privatePage: true }, 'private-page'], [{ canonicalHost: false }, 'noncanonical-host'],
  ] as const)('rejects %j', (extra, reason) => {
    expect(gate(extra)).toEqual({ indexable: false, reason })
  })
  it.each(['/admin', '/admin/users', '/pizza/admin', '/pizza/me', '/pizza/checkout/123', '/pizza/%61dmin', '/api/orders', '/preview', '/pizza/staging', '/pizza/draft'])('blocks private route %s', pathname => {
    expect(gate({ pathname })).toEqual({ indexable: false, reason: 'private-route' })
  })
  it.each(['/pizza-admin', '/pizza/administrator', '/pizza/blog', '/pizza/menus-special', '/pizza/menu', '/pizza/menus', '/pizza/settings'])('matches private routes on whole segments: %s', pathname => {
    expect(gate({ pathname }).indexable).toBe(true)
  })
  it('uses one noindex decision for all crawler outputs', () => {
    const site = resolve({ tenant: { ...tenant, is_demo: true }, pathname: '/pizza' })
    expect(siteRobots(site)).toEqual({ index: false, follow: false })
    expect(siteRobotsText(site)).toBe('User-agent: *\nDisallow: /\n')
    expect(siteRobotsText(site)).not.toContain('Sitemap:')
  })
  it.each(['staging.xprout.app', 'xmartmenu-stage.skale.club', 'preview.partner.com', 'project-123.vercel.app', 'localhost:3000'])('blocks preview configuration %s', host => {
    expect(resolve({ host, platformOrigin: `https://${host}` }).indexable).toBe(false)
  })
})

describe('malicious Host handling', () => {
  it.each(['https://xprout.app', 'xprout.app/path', 'xprout.app@evil.com', 'xprout.app,evil.com', 'xprout.app:abc', 'xprout.app:65536', 'xprout.app:0', 'xprout.app:443:80', ' xprout.app', 'xprout.app\n', 'xprout..app', '-xprout.app', ''])('fails closed for %j', host => {
    expect(normalizeSiteHost(host)).toBeNull()
    const site = resolve({ host })
    expect(site.indexable).toBe(false)
    expect(site.canonicalUrl).toBe('https://xprout.app')
  })
  it('normalizes hostname casing and a valid port', () => {
    expect(normalizeSiteHost('XPROUT.APP:443')).toBe('xprout.app')
  })
  it.each(['//evil.com', 'https://evil.com', '/\\evil.com'])('does not put invalid path %s in canonical output', pathname => {
    const site = resolve({ pathname })
    expect(site.canonicalUrl).toBe('https://xprout.app')
    expect(site.indexable).toBe(false)
  })
})
