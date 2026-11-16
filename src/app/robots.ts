import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { loadSiteBrand } from '@/lib/site/runtime'
import { resolveSite } from '@/lib/site/resolve-site'
import { parseRequestSite, SITE_CONTEXT_HEADER } from '@/lib/site/request-contract'

// Platform-host robots.txt. Custom domains are rewritten by the middleware to
// the per-tenant `/[slug]/robots.txt` route, so this file only governs the
// platform domain itself.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHeaders = await headers()
  const site = parseRequestSite(requestHeaders.get(SITE_CONTEXT_HEADER))
    ?? resolveSite({ host: requestHeaders.get('host') ?? '', pathname: '/robots.txt', tenant: null, brand: await loadSiteBrand() })
  if (!site.indexable) return { rules: [{ userAgent: '*', disallow: '/' }] }
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/superadmin',
          '/dashboard',
          '/settings',
          '/menu',
          '/menus',
          '/orders',
          '/tenants',
          '/overview',
          '/users',
          '/onboarding',
          '/auth',
        ],
      },
    ],
    sitemap: `${site.origin}/sitemap.xml`,
  }
}
