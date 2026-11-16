import { createServiceClient } from '@/lib/supabase/server'
import { ownedModeActive } from '@/lib/data/owned-mode'
import { SITEMAP_HEADERS, sitemapIndexXml, sitemapUnavailable } from '@/lib/sitemap-xml'
import { resolveSite } from '@/lib/site/resolve-site'
import { legacySiteTenant, LEGACY_SITE_COLUMNS, missingSiteColumns } from '@/lib/site/runtime'
import { discoveryRequestSite } from '@/lib/site/discovery-request'

export const revalidate = 300

async function sitemapTenants() {
  if (ownedModeActive()) {
    const { ownedSitemapTenants } = await import('@/lib/data/public-seo-runtime')
    return ownedSitemapTenants()
  }
  const client = createServiceClient()
  const { data, error } = await client.from('tenants').select(LEGACY_SITE_COLUMNS)
    .eq('is_active', true).order('updated_at', { ascending: false }).limit(5000)
  if (error) throw error
  const flags = await client.from('tenants').select('id,brand_id,is_demo,published_at').eq('is_active', true).limit(5000)
  if (flags.error && !missingSiteColumns(flags.error)) throw flags.error
  const lifecycle = new Map((flags.data ?? []).map(row => [String(row.id), row]))
  return (data ?? []).map(row => legacySiteTenant(row, flags.error ? null : lifecycle.get(String(row.id)) ?? {}))
}

// Each tenant must pass exactly the same gate as its own robots and metadata.
export async function GET(request: Request) {
  try {
    const host = request.headers.get('host') ?? new URL(request.url).host
    const platform = await discoveryRequestSite(request)
    const brand = platform.brand
    if (!platform.indexable) return new Response('Not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex', Vary: 'Host' } })
    const tenants = await sitemapTenants()
    const sites = tenants.map(tenant => resolveSite({ host, pathname: `/${tenant.slug}`, tenant, brand }))
      .filter(site => site.indexable && site.kind === 'tenant-path')
    const locs = [`${platform.origin}/sitemaps/platform.xml`, ...sites.map(site => `${site.baseUrl}/sitemap.xml`)]
    return new Response(sitemapIndexXml(locs), { headers: { ...SITEMAP_HEADERS, Vary: 'Host' } })
  } catch (error) {
    return sitemapUnavailable('index', error)
  }
}
