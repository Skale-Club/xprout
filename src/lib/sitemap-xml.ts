export const SITEMAP_HEADERS = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=604800',
} as const

export const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Response for a failure that is expected to pass: retry later, never index it. Always logged. */
export function sitemapUnavailable(scope: string, error: unknown): Response {
  console.error(`[sitemap] ${scope}:`, error)
  return new Response('Service unavailable', { status: 503, headers: { 'Retry-After': '300', 'X-Robots-Tag': 'noindex' } })
}

export const sitemapIndexXml = (locs: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locs.map(l => `<sitemap><loc>${xmlEscape(l)}</loc></sitemap>`).join('\n')}\n</sitemapindex>`

export interface SitemapUrl { url: string; lastModified?: Date | string; changeFrequency?: string; priority?: number }
const lastmod = (d?: Date | string) => {
  if (!d) return ''
  const date = d instanceof Date ? d : new Date(d)
  return Number.isFinite(date.getTime()) ? `<lastmod>${date.toISOString().slice(0, 10)}</lastmod>` : ''
}
export const urlsetXml = (entries: SitemapUrl[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(e =>
    `<url><loc>${xmlEscape(e.url)}</loc>${lastmod(e.lastModified)}${e.changeFrequency ? `<changefreq>${e.changeFrequency}</changefreq>` : ''}${e.priority !== undefined ? `<priority>${e.priority}</priority>` : ''}</url>`).join('\n')}\n</urlset>`
