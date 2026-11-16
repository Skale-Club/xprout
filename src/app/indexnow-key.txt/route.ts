import { requestSite } from '@/lib/site/request-runtime'
import { indexNowKey } from '@/lib/site/publish-effects'

export async function GET() {
  const key = indexNowKey(process.env)
  if (!key) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } })
  try {
    const site = await requestSite()
    if (!site.indexable) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', Vary: 'Host' } })
    return new Response(key, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'X-Robots-Tag': 'noindex', Vary: 'Host' } })
  } catch { return new Response('Service unavailable', { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '300', 'X-Robots-Tag': 'noindex' } }) }
}
