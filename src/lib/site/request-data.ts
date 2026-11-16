import { isPlatformHost } from '../brand'
import { resolveCustomDomainRoute } from '../custom-domain-routing'
import { readHostTenantSlug } from '../data/tenant-domain'
import { readHostBrand, readSeoTenant, readSiteBrand, tenantSitemapCatalog, type SeoTenant } from '../data/public-seo'
import type { AdminMenuQuery } from '../data/admin-menus'
import { subdomainBase } from '../tenant-subdomain'
import { normalizeSiteHost, resolveSite, type SiteBrand } from './resolve-site'
import type { RequestSite } from './request-contract'

const DEFAULT_ID = '00000000-0000-4000-8000-000000000001'
const GLOBAL = new Set(['api','auth','oauth','identity','checkout','onboarding','staff-access','_next','.well-known','monitoring','privacy','terms','demo'])
const MARKETING = new Set(['','pricing','blog','robots.txt','sitemap.xml','sitemaps','llms.txt','manifest.webmanifest','opengraph-image','twitter-image','favicon.ico','icon.png','apple-icon.png'])
const DISCOVERY = new Set(['robots.txt','sitemap.xml','sitemaps','llms.txt','manifest.webmanifest','opengraph-image','twitter-image','favicon.ico','icon.png','apple-icon.png'])

async function pagePrivate(query: AdminMenuQuery, tenant: SeoTenant, pathname: string): Promise<boolean> {
  const prefix = `/${tenant.slug}`
  const local = pathname === prefix ? '/' : pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname
  if (local.split('/').filter(Boolean).length > 1 || /\.(?:xml|txt|webmanifest)$/.test(local)) return false
  const [menus, locations] = await Promise.all([
    query('SELECT id, slug, is_default, is_private FROM public.menus WHERE tenant_id=$1 AND is_active=true ORDER BY position,id LIMIT 1000', [tenant.id]),
    query('SELECT slug, menu_id FROM public.locations WHERE tenant_id=$1 AND is_active=true ORDER BY created_at,id LIMIT 1000', [tenant.id]),
  ])
  const catalog = tenantSitemapCatalog(menus.rows, locations.rows)
  if (local === '/') return !catalog.rootIsPublic
  const slug = local.slice(1)
  return (menus.rows.some(row => row.slug === slug) || locations.rows.some(row => row.slug === slug))
    && !catalog.menus.some(row => row.slug === slug) && !catalog.locations.some(row => row.slug === slug)
}

/** All routing facts are read in one bounded read-only snapshot. */
export async function readRequestSite(query: AdminMenuQuery, authority: string, pathname: string, brandHint?: string): Promise<RequestSite> {
  const host = normalizeSiteHost(authority)
  if (!host || pathname.length > 800 || !pathname.startsWith('/') || pathname.startsWith('//') || /[\\\r\n\0]/.test(pathname)) throw new Error('Invalid site request')
  const first = pathname.split('/')[1] ?? ''
  let brand = await readHostBrand(query, host)
  // Brand hints only decorate the canonical platform's sign-in; they never
  // authorize a callback/origin, select a tenant, or change account access.
  if (pathname === '/auth/login' && isPlatformHost(host) && brandHint && /^[0-9a-f-]{36}$/i.test(brandHint)) brand = await readSiteBrand(query, brandHint)
  let tenant: SeoTenant | null = null
  let rewrite: string | null = null
  let foreignTenant = false
  if (!GLOBAL.has(first)) {
    let slug = await readHostTenantSlug(query, host, subdomainBase())
    if (!slug && !brand && host.split('.').length >= 3) {
      const base = host.split('.').slice(1).join('.')
      const partner = await readHostBrand(query, base)
      if (partner && partner.id !== DEFAULT_ID) {
        slug = await readHostTenantSlug(query, host, base)
        if (slug) brand = partner
      }
    }
    if (slug) {
      tenant = await readSeoTenant(query, slug)
      if (tenant) {
        const assigned = await readSiteBrand(query, tenant.brand_id)
        if (brand && assigned && brand.id !== assigned.id) throw new Error('Host brand does not own this tenant')
        brand = assigned
        const route = resolveCustomDomainRoute(pathname, slug)
        rewrite = route.kind === 'rewrite' ? route.pathname : null
      }
    } else if (brand || isPlatformHost(host)) {
      brand ??= await readSiteBrand(query)
      if (!MARKETING.has(first)) tenant = await readSeoTenant(query, first)
      if (tenant && (tenant.brand_id ?? DEFAULT_ID) !== (brand?.id ?? DEFAULT_ID)) {
        tenant = null
        foreignTenant = true
        rewrite = `/brand-site/${brand?.primary_host ?? host}/not-found`
      }
      if (!foreignTenant && brand?.apex_tenant_id && !tenant && (!MARKETING.has(first) || first === '' || DISCOVERY.has(first) || (brand.tenant_marketing_routes && ['pricing','blog'].includes(first)))) {
        const found = await query('SELECT slug FROM public.tenants WHERE id=$1 LIMIT 2', [brand.apex_tenant_id])
        if (found.rows.length !== 1) throw new Error('Brand apex tenant is unavailable')
        tenant = await readSeoTenant(query, String(found.rows[0].slug))
        if (!tenant || (tenant.brand_id ?? DEFAULT_ID) !== brand.id) throw new Error('Brand apex tenant mismatch')
        rewrite = DISCOVERY.has(first) ? null : `/brand-site/${brand.primary_host}${pathname === '/' ? '' : pathname}`
      } else if (!foreignTenant && brand && brand.id !== DEFAULT_ID && !tenant && MARKETING.has(first) && !DISCOVERY.has(first)) {
        rewrite = `/brand-site/${brand.primary_host}${pathname === '/' ? '' : pathname}`
      }
    }
  } else if (!brand && isPlatformHost(host)) brand = await readSiteBrand(query)
  const privatePage = tenant && !rewrite?.startsWith('/brand-site/') ? await pagePrivate(query, tenant, rewrite ?? pathname) : false
  const site = resolveSite({ host: authority, pathname: rewrite?.startsWith('/brand-site/') ? pathname : rewrite ?? pathname, tenant, brand, privatePage })
  // An unknown host must not acquire the fallback brand simply because no row matched.
  if (!brand && !tenant && !isPlatformHost(host)) { site.indexable = false; site.reason = 'noncanonical-host' }
  if (foreignTenant) { site.indexable = false; site.reason = 'brand-mismatch' }
  return { ...site, pathname, rewrite, privatePage }
}
