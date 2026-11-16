import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { parseRequestSite, serializeRequestSite, SITE_CONTEXT_HEADER, SITE_PATH_HEADER, type RequestSite } from '@/lib/site/request-contract'
import { resolveSite } from '@/lib/site/resolve-site'
import { PRIVATE_HTML_CACHE, PUBLIC_HTML_CACHE } from '@/lib/site/cache-policy'

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), session: vi.fn() }))
vi.mock('@/lib/site/request-lookup', () => ({ lookupRequestSite: mocks.lookup }))
vi.mock('@/lib/supabase/middleware', () => ({ updateSession: mocks.session }))
vi.mock('@/lib/data/owned-mode', () => ({ ownedModeActive: () => true }))
vi.mock('@/lib/custom-domain-lookup', () => ({ resolveOwnedDomainSlug: vi.fn(async () => null), rememberDomain: vi.fn() }))
import { middleware } from '@/middleware'

const host = 'restaurant.example.org'
const tenant = { slug: 'pizza', name: 'Pizza', is_active: true, is_demo: false, published_at: '2026-01-01T00:00:00Z', custom_domain: host, custom_domain_verified: true }
const site: RequestSite = { ...resolveSite({ host, pathname: '/pizza', tenant, platformOrigin: 'https://xprout.app' }), pathname: '/', rewrite: '/pizza', privatePage: false }
const request = (path = '/', headers: Record<string, string> = {}) => new NextRequest(`https://${host}${path}`, { headers: { host, accept: 'text/html', ...headers } })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.lookup.mockResolvedValue(site)
  mocks.session.mockImplementation(async (req: NextRequest, url?: URL) => url ? NextResponse.rewrite(url, { request: { headers: req.headers } }) : NextResponse.next({ request: { headers: req.headers } }))
})

describe('middleware site authority and cache boundary', () => {
  it('overwrites both attacker-controlled context and original-path headers before forwarding', async () => {
    const forged = serializeRequestSite({ ...site, origin: 'https://evil.example.org', indexable: true })
    const response = await middleware(request('/', { [SITE_CONTEXT_HEADER]: forged, [SITE_PATH_HEADER]: '/admin' }))
    const forwarded = mocks.session.mock.calls[0][0] as NextRequest
    expect(parseRequestSite(forwarded.headers.get(SITE_CONTEXT_HEADER))).toEqual(site)
    expect(forwarded.headers.get(SITE_PATH_HEADER)).toBe('/')
    expect(response.headers.get(`x-middleware-request-${SITE_CONTEXT_HEADER}`)).not.toContain('evil.example.org')
    expect(response.headers.get('cache-control')).toBe(PUBLIC_HTML_CACHE)
  })
  it.each([
    ['cookie', '/', { cookie: 'visitor=one' }], ['other cookie', '/', { cookie: 'visitor=two' }],
    ['table', '/?table=fixture', {}], ['language', '/?lang=pt', {}], ['view', '/?view=feed', {}],
    ['RSC', '/', { rsc: '1' }], ['prefetch', '/', { 'next-router-prefetch': '1' }],
  ] as const)('denies shared cache for %s', async (_name, path, headers) => {
    expect((await middleware(request(path, headers))).headers.get('cache-control')).toBe(PRIVATE_HTML_CACHE)
  })
  it('denies shared cache and indexing for a private menu', async () => {
    mocks.lookup.mockResolvedValue({ ...site, privatePage: true, indexable: false, reason: 'private-page' })
    const response = await middleware(request())
    expect(response.headers.get('cache-control')).toBe(PRIVATE_HTML_CACHE)
    expect(response.headers.get('x-robots-tag')).toContain('noindex')
  })
  it('never marks a response with a newly set cookie as publicly cacheable', async () => {
    mocks.session.mockImplementation(async () => {
      const response = NextResponse.next()
      response.cookies.set('fixture-session', 'opaque')
      return response
    })
    expect((await middleware(request())).headers.get('cache-control')).toBe(PRIVATE_HTML_CACHE)
  })
  it('does not let spoofed public context authorize internal API requests', async () => {
    await middleware(request('/api/internal/resolve-site', { [SITE_CONTEXT_HEADER]: serializeRequestSite(site) }))
    expect(mocks.lookup).not.toHaveBeenCalled()
    expect(mocks.session).not.toHaveBeenCalled()
  })
})
