import { loadSiteIdentity } from '@/lib/site/runtime'
import { resolveSite } from '@/lib/site/resolve-site'
import { discoveryTextResponse, siteLlmsText } from '@/lib/site/discovery-runtime'

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const identity = await loadSiteIdentity(slug)
    if (!identity) return discoveryTextResponse('')
    const site = resolveSite({ ...identity, host: request.headers.get('host') ?? new URL(request.url).host, pathname: `/${slug}/llms.txt` })
    return discoveryTextResponse(await siteLlmsText(site))
  } catch { return new Response('Service unavailable', { status: 503, headers: { 'Retry-After': '300', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', Vary: 'Host' } }) }
}
