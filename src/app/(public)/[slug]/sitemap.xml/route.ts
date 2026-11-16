import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getCanonicalUrl } from '@/lib/seo'
import { ownedModeActive } from '@/lib/data/owned-mode'
import { SITEMAP_HEADERS, urlsetXml, sitemapUnavailable, type SitemapUrl } from '@/lib/sitemap-xml'

export const revalidate = 300

const entry = (url: string, lastModified?: string | null, priority = 0.8): SitemapUrl => ({ url, lastModified: lastModified ?? undefined, priority })

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  try {
    if (ownedModeActive()) {
      // Own PostgreSQL only; an outage is a 503, never a read of the stale copy.
      const { ownedTenantSitemap } = await import('@/lib/data/public-seo-runtime')
      const found = await ownedTenantSitemap(slug)
      if (!found) return new NextResponse('Not found', { status: 404 })
      const { tenant, menus, locations } = found
      const owned = [entry(getCanonicalUrl(tenant, '/'), tenant.updated_at, 1)]
      // Menus have no updated_at column, so they carry no lastmod.
      for (const menu of menus) if (!menu.is_default) owned.push(entry(getCanonicalUrl(tenant, `/${menu.slug}`)))
      for (const loc of locations) owned.push(entry(getCanonicalUrl(tenant, `/${loc.slug}`), loc.updated_at))
      // Published website pages (none until the schema step ran or while the plan lacks them).
      const { ownedPublishedPageEntries } = await import('@/lib/data/tenant-pages-runtime')
      for (const page of await ownedPublishedPageEntries(tenant.id).catch(() => [])) owned.push(entry(getCanonicalUrl(tenant, `/${page.slug}`), page.updated_at))
      return new NextResponse(urlsetXml(owned), { headers: SITEMAP_HEADERS })
    }

    const supabase = createServiceClient()
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, slug, custom_domain, custom_domain_verified, updated_at')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()
    if (!tenant) return new NextResponse('Not found', { status: 404 })

    const [menus, locations] = await Promise.all([
      supabase.from('menus').select('slug, is_default').eq('tenant_id', tenant.id).eq('is_active', true).order('position'),
      supabase.from('locations').select('slug, updated_at').eq('tenant_id', tenant.id).eq('is_active', true).order('created_at', { ascending: true }),
    ])
    if (menus.error) throw menus.error
    if (locations.error) throw locations.error

    const entries = [entry(getCanonicalUrl(tenant, '/'), tenant.updated_at, 1)]
    for (const menu of menus.data ?? []) if (!menu.is_default) entries.push(entry(getCanonicalUrl(tenant, `/${menu.slug}`)))
    for (const loc of locations.data ?? []) entries.push(entry(getCanonicalUrl(tenant, `/${loc.slug}`), loc.updated_at))
    return new NextResponse(urlsetXml(entries), { headers: SITEMAP_HEADERS })
  } catch (error) {
    return sitemapUnavailable(`tenant ${slug}`, error)
  }
}
