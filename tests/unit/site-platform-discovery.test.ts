import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ headers: vi.fn(), brand: vi.fn(), sitemap: vi.fn() }))
vi.mock('next/headers', () => ({ headers: mocks.headers }))
vi.mock('@/lib/site/runtime', () => ({ loadSiteBrand: mocks.brand }))
vi.mock('@/lib/blog/native/selected', () => ({ nativeBlogSelected: () => true }))
vi.mock('@/lib/blog/native/sitemap', () => ({ nativePlatformSitemap: mocks.sitemap }))
vi.mock('@/lib/data/owned-mode', () => ({ ownedModeActive: () => true }))
vi.mock('@/lib/data/public-seo-runtime', () => ({ ownedPlatformBlogSitemap: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => { throw new Error('Unexpected legacy database') } }))

import robots from '@/app/robots'
import { GET } from '@/app/sitemaps/platform.xml/route'

const brand = {
  id: '00000000-0000-4000-8000-000000000001', name: 'Xprout', primary_host: 'xprout.app',
  extra_hosts: ['www.xprout.app'], default_lang: 'en',
}
const request = (host: string) => new Request(`https://${host}/sitemaps/platform.xml`, { headers: { host } })

beforeEach(() => {
  vi.resetAllMocks()
  mocks.headers.mockResolvedValue(new Headers({ host: 'xprout.app' }))
  mocks.brand.mockResolvedValue(brand)
  mocks.sitemap.mockResolvedValue([
    { url: 'https://xprout.app', priority: 1 },
    { url: 'https://xprout.app/pricing', priority: 0.8 },
    { url: 'https://xprout.app/blog/current-post', lastModified: '2026-11-01T00:00:00Z' },
  ])
})

describe('platform discovery shares canonical-host policy', () => {
  it('preserves normal robots exclusions and the canonical sitemap', async () => {
    const result = await robots()
    expect(result.sitemap).toBe('https://xprout.app/sitemap.xml')
    expect(result.rules).toEqual([expect.objectContaining({ userAgent: '*', allow: '/', disallow: expect.arrayContaining(['/api/', '/admin', '/auth']) })])
  })

  it.each(['unknown.com', 'staging.xprout.app', 'www.xprout.app'])('denies robots and the platform leaf sitemap on %s', async host => {
    mocks.headers.mockResolvedValue(new Headers({ host }))
    const policy = await robots()
    expect(policy).toEqual({ rules: [{ userAgent: '*', disallow: '/' }] })
    expect(policy.sitemap).toBeUndefined()
    const response = await GET(request(host))
    expect(response.status).toBe(404)
    expect(response.headers.get('x-robots-tag')).toBe('noindex')
    expect(response.headers.get('vary')).toBe('Host')
    expect(mocks.sitemap).not.toHaveBeenCalled()
  })

  it('preserves platform sitemap content and host isolation on its canonical host', async () => {
    const response = await GET(request('xprout.app'))
    expect(response.status).toBe(200)
    expect(response.headers.get('vary')).toBe('Host')
    expect(response.headers.get('content-type')).toContain('application/xml')
    const xml = await response.text()
    expect(xml).toContain('<loc>https://xprout.app</loc>')
    expect(xml).toContain('<loc>https://xprout.app/pricing</loc>')
    expect(xml).toContain('<loc>https://xprout.app/blog/current-post</loc><lastmod>2026-11-01</lastmod>')
    expect(mocks.sitemap).toHaveBeenCalledOnce()
  })

  it('propagates robots identity failure instead of emitting a successful crawl policy', async () => {
    mocks.brand.mockRejectedValue(new Error('Brand unavailable'))
    await expect(robots()).rejects.toThrow('Brand unavailable')
  })

  it('returns a retryable uncached sitemap failure when brand identity is unavailable', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mocks.brand.mockRejectedValue(new Error('Brand unavailable'))
      const response = await GET(request('xprout.app'))
      expect(response.status).toBe(503)
      expect(response.headers.get('retry-after')).toBe('300')
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(response.headers.get('x-robots-tag')).toBe('noindex')
      expect(mocks.sitemap).not.toHaveBeenCalled()
    } finally { log.mockRestore() }
  })
})
