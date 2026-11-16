import { requestSite } from '@/lib/site/request-runtime'
import { discoveryTextResponse, siteLlmsText } from '@/lib/site/discovery-runtime'

export const dynamic = 'force-dynamic'

export async function GET() {
  try { return discoveryTextResponse(await siteLlmsText(await requestSite())) }
  catch { return new Response('Service unavailable', { status: 503, headers: { 'Retry-After': '300', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', Vary: 'Host' } }) }
}
