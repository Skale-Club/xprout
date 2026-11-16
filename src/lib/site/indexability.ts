export type IndexabilityReason =
  | 'indexable' | 'noncanonical-host' | 'preview' | 'private-page'
  | 'private-route' | 'inactive' | 'unpublished' | 'demo' | 'seo-noindex' | 'brand-mismatch'

export interface IndexabilityInput {
  isActive?: boolean
  publishedAt?: string | null
  isDemo?: boolean
  seoNoindex?: boolean | null
  canonicalHost: boolean
  preview?: boolean
  privatePage?: boolean
  brandMatched?: boolean
  pathname: string
  tenantSlug?: string
  /** Request time supplied by the caller, keeping this decision deterministic. */
  now?: number
}

const PRIVATE_SEGMENTS = new Set([
  'api', 'admin', 'superadmin', 'dashboard', 'settings', 'menu', 'menus',
  'orders', 'tenants', 'overview', 'users', 'onboarding', 'auth', 'oauth',
  'identity', 'checkout', 'me', 'waiter', 'login', 'logout', 'monitoring', 'preview', 'staging', 'draft',
])
// Global back-office paths can also be legitimate menu/page names inside a
// restaurant namespace (for example /pizza/menu). Only actual protected paths
// remain private there; private menus are denied separately by privatePage.
const GLOBAL_ONLY_SEGMENTS = new Set(['menu', 'menus', 'settings', 'orders', 'tenants', 'overview', 'users', 'dashboard'])

/** One decision shared by metadata, response headers and discovery documents. */
export function indexability(input: IndexabilityInput): { indexable: boolean; reason: IndexabilityReason } {
  const deny = (reason: IndexabilityReason) => ({ indexable: false, reason })
  if (!input.canonicalHost) return deny('noncanonical-host')
  if (input.preview) return deny('preview')
  if (input.brandMatched === false) return deny('brand-mismatch')
  if (input.privatePage) return deny('private-page')
  let path = input.pathname.split(/[?#]/u)[0]
  try { path = decodeURIComponent(path) } catch { return deny('private-route') }
  const segments = path.toLowerCase().split('/').filter(Boolean)
  const tenantPath = Boolean(input.tenantSlug && segments[0] === input.tenantSlug.toLowerCase())
  if (tenantPath) segments.shift()
  if (segments[0] && PRIVATE_SEGMENTS.has(segments[0]) && !(tenantPath && GLOBAL_ONLY_SEGMENTS.has(segments[0]))) return deny('private-route')
  // A brand has no tenant lifecycle. A tenant must explicitly satisfy every flag.
  if (input.tenantSlug !== undefined) {
    if (input.isActive !== true) return deny('inactive')
    const published = typeof input.publishedAt === 'string' && /^\d{4}-\d{2}-\d{2}T/u.test(input.publishedAt)
      ? Date.parse(input.publishedAt) : Number.NaN
    if (!Number.isFinite(published) || published > (input.now ?? Date.now())) return deny('unpublished')
    if (input.isDemo !== false) return deny('demo')
    if (input.seoNoindex === true) return deny('seo-noindex')
  }
  return { indexable: true, reason: 'indexable' }
}

export const getIndexability = indexability

export function siteRobots(site: { indexable: boolean }): { index: boolean; follow: boolean } {
  return { index: site.indexable, follow: site.indexable }
}

export function siteRobotsText(site: { indexable: boolean; baseUrl: string }): string {
  return site.indexable
    ? `User-agent: *\nAllow: /\nSitemap: ${site.baseUrl.replace(/\/$/u, '')}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n'
}
