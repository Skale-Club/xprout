import { createServiceClient } from '../supabase/server'
import { isPlatformHost } from '../brand'
import { resolveCustomDomainRoute } from '../custom-domain-routing'
import { tenantSitemapCatalog } from '../data/public-seo'
import { loadSiteBrand, loadSiteIdentity } from './runtime'
import { normalizeSiteHost, resolveSite, type SiteBrand } from './resolve-site'
import type { RequestSite } from './request-contract'

/** Development counterpart. Production never calls this in owned mode. */
export async function legacyRequestSite(authority: string, pathname: string): Promise<RequestSite> {
  const host = normalizeSiteHost(authority)
  if (!host) throw new Error('Invalid site host')
  const client = createServiceClient()
  const first = pathname.split('/')[1] ?? ''
  let brand: SiteBrand | undefined
  const brands = await client.from('brands').select('*').or(`primary_host.eq.${host},extra_hosts.cs.{${host}}`).limit(2)
  if (brands.error && !['42P01','PGRST205'].includes(brands.error.code)) throw new Error('Site brands unavailable')
  if ((brands.data ?? []).length > 1) throw new Error('Ambiguous site brand')
  brand = brands.data?.[0] as SiteBrand | undefined
  if (!brand && isPlatformHost(host)) brand = await loadSiteBrand()
  let slug = ''
  if (!isPlatformHost(host) && !brand) {
    const found = await client.from('tenants').select('slug').eq('custom_domain', host).eq('custom_domain_verified', true).eq('is_active', true).limit(2)
    if (found.error) throw new Error('Site domain unavailable')
    if (found.data?.length === 1) slug = found.data[0].slug
  } else if (!['','pricing','blog','robots.txt','sitemap.xml','sitemaps','llms.txt','auth','api','identity','oauth','checkout','onboarding','privacy','terms'].includes(first)) slug = first
  let identity = slug ? await loadSiteIdentity(slug) : null
  const foreign = Boolean(identity && brand && (identity.tenant.brand_id ?? '00000000-0000-4000-8000-000000000001') !== brand.id)
  if (foreign) identity = null
  if (identity && (!brand || (identity.tenant.brand_id ?? '00000000-0000-4000-8000-000000000001') === brand.id)) brand = identity.brand ?? brand
  const discovery = ['robots.txt','sitemap.xml','sitemaps','llms.txt','manifest.webmanifest','opengraph-image','twitter-image','icon.png','apple-icon.png','indexnow-key.txt']
  const global = ['api','auth','oauth','identity','checkout','onboarding','staff-access','privacy','terms','demo','_next','.well-known']
  const marketing = ['','pricing','blog',...discovery]
  if (!foreign && !identity && brand?.apex_tenant_id && !global.includes(first)
    && (!marketing.includes(first) || first === '' || discovery.includes(first) || brand.tenant_marketing_routes)) {
    const apex = await client.from('tenants').select('slug').eq('id',brand.apex_tenant_id).single()
    if (apex.error || !apex.data) throw new Error('Brand apex unavailable')
    identity = await loadSiteIdentity(apex.data.slug)
    if (!identity || (identity.tenant.brand_id ?? '00000000-0000-4000-8000-000000000001') !== brand.id) throw new Error('Brand apex mismatch')
  }
  const tenant = identity?.tenant ?? null
  const route = tenant && host !== brand?.primary_host && !isPlatformHost(host) ? resolveCustomDomainRoute(pathname, tenant.slug) : { kind: 'pass' as const }
  let rewrite = route.kind === 'rewrite' ? route.pathname : null
  if (foreign) rewrite = `/brand-site/${brand?.primary_host ?? host}/not-found`
  else if (tenant && brand?.apex_tenant_id && brand.apex_tenant_id === tenant.id && !discovery.includes(first) && !global.includes(first)) rewrite = `/brand-site/${brand.primary_host}${pathname === '/' ? '' : pathname}`
  else if (!tenant && brand && brand.id !== '00000000-0000-4000-8000-000000000001' && !discovery.includes(first) && !global.includes(first)) rewrite = `/brand-site/${brand.primary_host}${pathname === '/' ? '' : pathname}`
  let privatePage = false
  if (tenant && tenant.id !== brand?.apex_tenant_id) {
    const [menus, locations] = await Promise.all([
      client.from('menus').select('id,slug,is_default,is_private').eq('tenant_id',tenant.id).eq('is_active',true).order('position'),
      client.from('locations').select('slug,menu_id').eq('tenant_id',tenant.id).eq('is_active',true).order('created_at'),
    ])
    if (menus.error || locations.error) throw new Error('Public site catalog unavailable')
    const catalog = tenantSitemapCatalog(menus.data ?? [], locations.data ?? [])
    const local = (rewrite ?? pathname).slice(`/${tenant.slug}`.length) || '/'
    privatePage = local === '/' ? !catalog.rootIsPublic : ((menus.data ?? []).some(menu => `/${menu.slug}` === local)
      || (locations.data ?? []).some(location => `/${location.slug}` === local))
      && !catalog.menus.some(menu => `/${menu.slug}` === local) && !catalog.locations.some(location => `/${location.slug}` === local)
  }
  const site = resolveSite({ host: authority, pathname: rewrite?.startsWith('/brand-site/') ? pathname : rewrite ?? pathname, tenant, brand, privatePage })
  if (!brand && !tenant && !isPlatformHost(host)) { site.indexable = false; site.reason = 'noncanonical-host' }
  if (foreign) { site.indexable = false; site.reason = 'brand-mismatch' }
  return { ...site, pathname, rewrite, privatePage }
}
