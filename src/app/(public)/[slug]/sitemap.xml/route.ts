import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { ownedModeActive } from '@/lib/data/owned-mode'
import { SITEMAP_HEADERS, urlsetXml, sitemapUnavailable, type SitemapUrl } from '@/lib/sitemap-xml'
import { resolveSite } from '@/lib/site/resolve-site'
import { loadSiteIdentity } from '@/lib/site/runtime'
import { tenantSitemapCatalog } from '@/lib/data/public-seo'
import { loadTenantDiscoveryExtras } from '@/lib/site/discovery-extras'

export const revalidate = 300

const entry = (url: string, lastModified?: string | null, priority = 0.8): SitemapUrl => ({ url, lastModified: lastModified ?? undefined, priority })

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const host = request.headers.get('host') ?? new URL(request.url).host
  const hidden = () => new NextResponse('Not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex', 'Vary': 'Host' } })
  try {
    if (ownedModeActive()) {
      // Own PostgreSQL only; an outage is a 503, never a read of the stale copy.
      const { ownedTenantSitemap } = await import('@/lib/data/public-seo-runtime')
      const found = await ownedTenantSitemap(slug)
      if (!found) return new NextResponse('Not found', { status: 404 })
      const { tenant, brand, menus, locations, rootIsPublic } = found
      const site = resolveSite({ tenant, brand, host, pathname: `/${slug}/sitemap.xml` })
      if (!site.indexable) return hidden()
      const canonical = (path: string) => `${site.baseUrl}${path === '/' ? '' : path}`
      const indexable = (path: string) => resolveSite({ tenant, brand, host, pathname: `/${slug}${path}` }).indexable
      const owned = rootIsPublic ? [entry(canonical('/'), tenant.updated_at, 1)] : []
      // Menus have no updated_at column, so they carry no lastmod.
      for (const menu of menus) if (!menu.is_default && indexable(`/${menu.slug}`)) owned.push(entry(canonical(`/${menu.slug}`)))
      for (const loc of locations) if (indexable(`/${loc.slug}`)) owned.push(entry(canonical(`/${loc.slug}`), loc.updated_at))
      // Published website pages (none until the schema step ran or while the plan lacks them).
      const { ownedPublishedPageEntries } = await import('@/lib/data/tenant-pages-runtime')
      for (const page of await ownedPublishedPageEntries(tenant.id)) if (indexable(`/${page.slug}`)) owned.push(entry(canonical(`/${page.slug}`), page.updated_at))
      for (const extra of await loadTenantDiscoveryExtras(tenant.id, site.baseUrl)) if (indexable(extra.url.slice(site.baseUrl.length))) owned.push(extra)
      return new NextResponse(urlsetXml(owned.slice(0, 5000)), { headers: { ...SITEMAP_HEADERS, Vary: 'Host' } })
    }

    const supabase = createServiceClient()
    const identity = await loadSiteIdentity(slug)
    if (!identity) return hidden()
    const { tenant } = identity
    const site = resolveSite({ ...identity, host, pathname: `/${slug}/sitemap.xml` })
    if (!site.indexable) return hidden()
    const canonical = (path: string) => `${site.baseUrl}${path === '/' ? '' : path}`
    const indexable = (path: string) => resolveSite({ ...identity, host, pathname: `/${slug}${path}` }).indexable

    const [menus, locations] = await Promise.all([
      supabase.from('menus').select('id, slug, is_default, is_private').eq('tenant_id', tenant.id).eq('is_active', true).order('position'),
      supabase.from('locations').select('slug, menu_id, updated_at').eq('tenant_id', tenant.id).eq('is_active', true).order('created_at', { ascending: true }),
    ])
    if (menus.error) throw menus.error
    if (locations.error) throw locations.error

    const catalog = tenantSitemapCatalog(menus.data ?? [], locations.data ?? [])
    const entries = catalog.rootIsPublic ? [entry(canonical('/'), tenant.updated_at, 1)] : []
    for (const menu of catalog.menus) if (!menu.is_default && indexable(`/${menu.slug}`)) entries.push(entry(canonical(`/${menu.slug}`)))
    for (const loc of catalog.locations) if (indexable(`/${loc.slug}`)) entries.push(entry(canonical(`/${loc.slug}`), loc.updated_at))
    for (const extra of await loadTenantDiscoveryExtras(tenant.id, site.baseUrl)) if (indexable(extra.url.slice(site.baseUrl.length))) entries.push(extra)
    return new NextResponse(urlsetXml(entries.slice(0, 5000)), { headers: { ...SITEMAP_HEADERS, Vary: 'Host' } })
  } catch (error) {
    return sitemapUnavailable(`tenant ${slug}`, error)
  }
}
