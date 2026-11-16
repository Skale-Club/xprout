import { createServiceClient } from '@/lib/supabase/server'
import { PLATFORM_BASE } from '@/lib/seo'
import { scopeFilter } from '@/lib/blog/scope'
import { listArchive, listTags } from '@/lib/blog/public-queries'
import { nativeBlogSelected } from '@/lib/blog/native/selected'
import { nativePlatformSitemap } from '@/lib/blog/native/sitemap'
import { ownedModeActive } from '@/lib/data/owned-mode'
import { SITEMAP_HEADERS, sitemapUnavailable, urlsetXml, type SitemapUrl } from '@/lib/sitemap-xml'
import { discoveryRequestSite } from '@/lib/site/discovery-request'

// Host authority must never be cached by pathname alone.
export const dynamic = 'force-dynamic'

// Platform pages only (landing, pricing, blog). Restaurants are listed by their own
// sitemaps, which the /sitemap.xml index points to. Static pages carry no lastmod.
const staticEntries = (): SitemapUrl[] => [
  { url: PLATFORM_BASE, changeFrequency: 'weekly', priority: 1 },
  { url: `${PLATFORM_BASE}/pricing`, changeFrequency: 'monthly', priority: 0.8 },
]

async function ownedBlogEntries(entries: SitemapUrl[]) {
  const runtime = await import('@/lib/data/public-seo-runtime')
  try {
    const blog = await runtime.ownedPlatformBlogSitemap()
    const posts = blog.posts.filter(post => { const date = Date.parse(post.published_at ?? ''); return Number.isFinite(date) && date <= Date.now() })
    if (!posts.length) return
    entries.push({ url: `${PLATFORM_BASE}/blog`, changeFrequency: 'weekly', priority: 0.7 })
    for (const tag of blog.tags) entries.push({ url: `${PLATFORM_BASE}/blog/tag/${tag}`, changeFrequency: 'weekly', priority: 0.5 })
    for (const year of new Set(blog.archive.map(e => e.year))) entries.push({ url: `${PLATFORM_BASE}/blog/archive/${year}`, changeFrequency: 'monthly', priority: 0.4 })
    for (const e of blog.archive) entries.push({ url: `${PLATFORM_BASE}/blog/archive/${e.year}/${String(e.month).padStart(2, '0')}`, changeFrequency: 'monthly', priority: 0.3 })
    for (const post of posts) entries.push({ url: `${PLATFORM_BASE}/blog/${post.slug}`, lastModified: post.updated_at ?? post.published_at ?? undefined, changeFrequency: 'monthly', priority: 0.6 })
  } catch (error) { console.error('[sitemap] platform blog:', error) }
}

export async function GET(request: Request) {
  let site: Awaited<ReturnType<typeof discoveryRequestSite>>
  try {
    site = await discoveryRequestSite(request)
    if (!site.indexable) return new Response('Not found', { status: 404,
      headers: { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store', Vary: 'Host' } })
  } catch (error) {
    const response = sitemapUnavailable('platform identity', error)
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('Vary', 'Host')
    return response
  }
  if (site.brand.id !== '00000000-0000-4000-8000-000000000001' || site.kind === 'brand-apex-tenant') {
    const entries: SitemapUrl[] = [{ url: site.origin, changeFrequency: 'weekly', priority: 1 }]
    // Website CMS is owned-only. Legacy development serves the documented
    // branded fallback and must never open an owned database for its sitemap.
    if (site.tenant?.id && ownedModeActive()) {
      const { ownedPublishedPageEntries } = await import('@/lib/data/tenant-pages-runtime')
      const pages = await ownedPublishedPageEntries(site.tenant.id)
      for (const page of pages) {
        if (page.slug === site.brand.apex_home_slug || (!site.brand.tenant_marketing_routes && ['pricing','blog'].includes(page.slug))) continue
        entries.push({ url: `${site.origin}/${page.slug}`, lastModified: page.updated_at })
      }
    }
    return new Response(urlsetXml(entries), { headers: { ...SITEMAP_HEADERS, Vary: 'Host' } })
  }
  let entries: SitemapUrl[]
  if (nativeBlogSelected()) entries = await nativePlatformSitemap()
  else {
    entries = staticEntries()
    if (ownedModeActive()) await ownedBlogEntries(entries)
    else await legacyBlogEntries(entries)
  }
  return new Response(urlsetXml(entries), { headers: { ...SITEMAP_HEADERS, Vary: 'Host' } })
}

async function legacyBlogEntries(entries: SitemapUrl[]) {
  try {
    const supabase = createServiceClient()
    // Platform scope only: tenant posts never appear under platform URLs.
    const { data: posts, error } = await scopeFilter(supabase.from('blog_posts').select('slug, published_at, updated_at'), null)
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
      .limit(1000)
    if (error) throw error
    if (!posts?.length) return
    entries.push({ url: `${PLATFORM_BASE}/blog`, changeFrequency: 'weekly', priority: 0.7 })
    const [tags, archive] = await Promise.all([
      listTags(supabase, null).catch(() => []),
      listArchive(supabase, null).catch(() => []),
    ])
    for (const tag of tags) entries.push({ url: `${PLATFORM_BASE}/blog/tag/${tag.slug}`, changeFrequency: 'weekly', priority: 0.5 })
    for (const year of new Set(archive.map(e => e.year))) entries.push({ url: `${PLATFORM_BASE}/blog/archive/${year}`, changeFrequency: 'monthly', priority: 0.4 })
    for (const e of archive) entries.push({ url: `${PLATFORM_BASE}/blog/archive/${e.year}/${String(e.month).padStart(2, '0')}`, changeFrequency: 'monthly', priority: 0.3 })
    for (const post of posts ?? []) entries.push({ url: `${PLATFORM_BASE}/blog/${post.slug}`, lastModified: post.updated_at ?? post.published_at ?? undefined, changeFrequency: 'monthly', priority: 0.6 })
  } catch (error) { console.error('[sitemap] platform blog:', error) }
}
