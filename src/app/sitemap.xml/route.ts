import { createServiceClient } from '@/lib/supabase/server'
import { PLATFORM_BASE, tenantOwnHost } from '@/lib/seo'
import { ownedModeActive } from '@/lib/data/owned-mode'
import { SITEMAP_HEADERS, sitemapIndexXml, sitemapUnavailable } from '@/lib/sitemap-xml'

export const revalidate = 300

// Index of the platform sitemap plus one sitemap per restaurant served on the platform host.
// A restaurant on its own host (custom domain or subdomain) serves its own sitemap there.
async function platformTenantSlugs(): Promise<string[]> {
  if (ownedModeActive()) {
    const { ownedSitemapTenants } = await import('@/lib/data/public-seo-runtime')
    return (await ownedSitemapTenants()).filter(t => !tenantOwnHost(t)).map(t => t.slug)
  }
  const { data, error } = await createServiceClient()
    .from('tenants')
    .select('slug, custom_domain, custom_domain_verified')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(5000)
  if (error) throw error
  return (data ?? []).filter(t => !(t.custom_domain && t.custom_domain_verified)).map(t => t.slug as string)
}

export async function GET() {
  try {
    const slugs = await platformTenantSlugs()
    const locs = [`${PLATFORM_BASE}/sitemaps/platform.xml`, ...slugs.map(slug => `${PLATFORM_BASE}/${slug}/sitemap.xml`)]
    return new Response(sitemapIndexXml(locs), { headers: SITEMAP_HEADERS })
  } catch (error) {
    return sitemapUnavailable('index', error)
  }
}
