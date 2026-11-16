import type { ResolvedSite } from './resolve-site'

export type PublishEnvironment = Record<string, string | undefined>
export function indexNowKey(env: PublishEnvironment): string | null {
  return env.NODE_ENV === 'production' && env.INDEXNOW_ENABLED === 'true' && /^[a-z0-9-]{8,128}$/iu.test(env.INDEXNOW_KEY ?? '') ? env.INDEXNOW_KEY! : null
}
export function publishEffectsEnabled(env: PublishEnvironment): boolean {
  return env.NODE_ENV === 'production' && Boolean(indexNowKey(env)
    || (env.CLOUDFLARE_PURGE_ENABLED === 'true' && env.CLOUDFLARE_API_TOKEN && /^[a-f0-9]{32}$/iu.test(env.CLOUDFLARE_ZONE_ID ?? '')))
}

export function publishUrls(site: ResolvedSite, paths: string[]): string[] {
  const safePaths = paths.filter(path => path.startsWith('/') && !path.startsWith('//') && !/[\\%?#]/u.test(path)
    && !path.split('/').some(segment => segment === '.' || segment === '..') && !/^\/(?:api|auth|admin|checkout|me)(?:\/|$)/u.test(path))
  const urls = [site.baseUrl, `${site.baseUrl}/sitemap.xml`, `${site.baseUrl}/llms.txt`, ...safePaths.map(path => `${site.baseUrl}${path === '/' ? '' : path}`)]
  return [...new Set(urls)].filter(value => {
    try { const url = new URL(value); return url.protocol === 'https:' && url.origin === site.origin && !url.search && !url.hash && !url.username && !url.password }
    catch { return false }
  }).slice(0, 100)
}

/** Optional post-commit delivery. No retries, external calls or credentials in development. */
export async function runPublishEffects(site: ResolvedSite, paths: string[], env: PublishEnvironment = process.env, fetcher: typeof fetch = fetch) {
  if (!publishEffectsEnabled(env)) return { indexnow: 'disabled', cloudflare: 'disabled' }
  if (['preview', 'noncanonical-host', 'brand-mismatch', 'private-page', 'private-route'].includes(site.reason)) return { indexnow: 'disabled', cloudflare: 'disabled' }
  const urls = publishUrls(site, paths), result = { indexnow: 'disabled', cloudflare: 'disabled' }
  if (!urls.length) return result
  const key = indexNowKey(env)
  if (key && site.indexable) {
    try {
      const response = await fetcher('https://api.indexnow.org/indexnow', { method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' }, signal: AbortSignal.timeout(5000),
        body: JSON.stringify({ host: new URL(site.origin).hostname, key, keyLocation: `${site.origin}/indexnow-key.txt`, urlList: urls }) })
      result.indexnow = response.ok ? 'submitted' : 'failed'
    } catch { result.indexnow = 'failed' }
  }
  if (env.CLOUDFLARE_PURGE_ENABLED === 'true' && env.CLOUDFLARE_API_TOKEN && /^[a-f0-9]{32}$/iu.test(env.CLOUDFLARE_ZONE_ID ?? '')) {
    try {
      const response = await fetcher(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/purge_cache`, {
        method: 'POST', headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: urls }), signal: AbortSignal.timeout(5000) })
      const body = response.ok ? await response.json() as { success?: boolean } : null
      result.cloudflare = response.ok && body?.success === true ? 'purged' : 'failed'
    } catch { result.cloudflare = 'failed' }
  }
  return result
}
