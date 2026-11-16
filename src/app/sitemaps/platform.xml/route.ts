import { createServiceClient } from '@/lib/supabase/server'
import { PLATFORM_BASE } from '@/lib/seo'
import { scopeFilter } from '@/lib/blog/scope'
import { listArchive, listTags } from '@/lib/blog/public-queries'
import { nativeBlogSelected } from '@/lib/blog/native/selected'
import { nativePlatformSitemap } from '@/lib/blog/native/sitemap'
import { ownedModeActive } from '@/lib/data/owned-mode'
import { SITEMAP_HEADERS, sitemapUnavailable, urlsetXml, type SitemapUrl } from '@/lib/sitemap-xml'
import { loadSiteBrand } from '@/lib/site/runtime'
import { resolveSite } from '@/lib/site/resolve-site'

export const revalidate = 300

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
    entries.push({ url: `${PLATFORM_BASE}/blog`, changeFrequency: 'weekly', priority: 0.7 })
    for (const tag of blog.tags) entries.push({ url: `${PLATFORM_BASE}/blog/tag/${tag}`, changeFrequency: 'weekly', priority: 0.5 })
    for (const year of new Set(blog.archive.map(e => e.year))) entries.push({ url: `${PLATFORM_BASE}/blog/archive/${year}`, changeFrequency: 'monthly', priority: 0.4 })
    for (const e of blog.archive) entries.push({ url: `${PLATFORM_BASE}/blog/archive/${e.year}/${String(e.month).padStart(2, '0')}`, changeFrequency: 'monthly', priority: 0.3 })
    for (const post of blog.posts) entries.push({ url: `${PLATFORM_BASE}/blog/${post.slug}`, lastModified: post.updated_at ?? post.published_at ?? undefined, changeFrequency: 'monthly', priority: 0.6 })
  } catch (error) { console.error('[sitemap] platform blog:', error) }
}

export async function GET(request: Request) {
  try {
    const brand = await loadSiteBrand()
    const site = resolveSite({ host: request.headers.get('host') ?? new URL(request.url).host,
      pathname: '/sitemaps/platform.xml', tenant: null, brand })
    if (!site.indexable) return new Response('Not found', { status: 404,
      headers: { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store', Vary: 'Host' } })
  } catch (error) {
    const response = sitemapUnavailable('platform identity', error)
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('Vary', 'Host')
    return response
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
    entries.push({ url: `${PLATFORM_BASE}/blog`, changeFrequency: 'weekly', priority: 0.7 })
    // Platform scope only: tenant posts never appear under platform URLs.
    const { data: posts } = await scopeFilter(supabase.from('blog_posts').select('slug, published_at, updated_at'), null)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(1000)
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
