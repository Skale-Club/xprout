import { INTERNAL_SITE_PATH, parseRequestSite, type RequestSite } from './request-contract'
import { normalizeSiteHost } from './resolve-site'

export interface SiteCacheEntry { site: RequestSite | null; expires: number }
const MAX_ENTRIES = 1000

/** No database/Node imports: share the bounded loopback pattern used by domain routing. */
export async function lookupRequestSite(host: string, pathname: string, cache: Map<string, SiteCacheEntry>, fetcher = fetch, now = Date.now, brandHint?: string): Promise<RequestSite | null> {
  if (!normalizeSiteHost(host) || pathname.length > 800) return null
  const hint = pathname === '/auth/login' && brandHint && /^[0-9a-f-]{36}$/i.test(brandHint) ? brandHint : ''
  const key = `${host.toLowerCase()}\n${pathname}\n${hint}`
  const previous = cache.get(key)
  if (previous && previous.expires > now()) return previous.site
  const remember = (site: RequestSite | null, ttl: number) => {
    cache.delete(key)
    while (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!)
    cache.set(key, { site, expires: now() + ttl })
    return site
  }
  try {
    const port = /^\d{1,5}$/.test(process.env.PORT ?? '') ? process.env.PORT : '3000'
    const url = `http://127.0.0.1:${port}${INTERNAL_SITE_PATH}?host=${encodeURIComponent(host)}&path=${encodeURIComponent(pathname)}${hint ? `&brand=${hint}` : ''}`
    const response = await fetcher(url, { cache: 'no-store', signal: AbortSignal.timeout(4000) })
    if (!response.ok) throw new Error('Site context unavailable')
    const text = await response.text()
    if (text.length > 12_000) throw new Error('Site context too large')
    const site = parseRequestSite(encodeURIComponent(text))
    if (!site || site.pathname !== pathname) throw new Error('Invalid site context')
    return remember(site, 60_000)
  } catch { return remember(null, 5_000) }
}
