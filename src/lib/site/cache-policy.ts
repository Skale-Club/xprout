import type { RequestSite } from './request-contract'

export const PUBLIC_HTML_CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=60'
export const PRIVATE_HTML_CACHE = 'private, no-store'
const PRIVATE_PATH = /^\/(?:api|auth|oauth|identity|checkout|onboarding|staff-access|admin|superadmin|dashboard|settings|menu|menus|orders|tenants|overview|users|plans|chat-inbox|_next|\.well-known)(?:\/|$)/

export function anonymousPublicHtml(request: { method: string; url: string; headers: Headers }, site: RequestSite | null): boolean {
  if (!site || request.method !== 'GET' || site.privatePage) return false
  const url = new URL(request.url)
  if (url.search || PRIVATE_PATH.test(site.pathname) && !site.tenant || /\/(?:me|waiter|preview|staging)(?:\/|$)/.test(site.pathname)) return false
  if (request.headers.has('cookie') || request.headers.has('authorization') || request.headers.has('rsc')
    || request.headers.has('next-router-prefetch') || request.headers.has('next-router-state-tree')) return false
  const accept = request.headers.get('accept') ?? ''
  if (accept && !accept.includes('text/html') && !accept.includes('*/*')) return false
  if (/\.(?:xml|txt|webmanifest|json|png|jpg|webp|svg|ico)$/.test(url.pathname)) return false
  return site.indexable || (site.tenant?.is_demo === true && site.tenant.is_active === true)
}
