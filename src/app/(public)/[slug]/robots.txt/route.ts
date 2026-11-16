import { NextResponse } from 'next/server'
import { loadSiteIdentity } from '@/lib/site/runtime'
import { resolveSite } from '@/lib/site/resolve-site'
import { siteRobotsText } from '@/lib/site/indexability'

export const revalidate = 300

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  try {
    const identity = await loadSiteIdentity(slug)
    if (!identity) return new NextResponse('User-agent: *\nDisallow: /\n', { status: 404, headers: { 'X-Robots-Tag': 'noindex' } })
    const site = resolveSite({ ...identity, host: request.headers.get('host') ?? new URL(request.url).host, pathname: `/${slug}/robots.txt` })
    return new NextResponse(siteRobotsText(site), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Vary': 'Host',
        'Cache-Control': 'public, max-age=0, s-maxage=300',
        ...(!site.indexable ? { 'X-Robots-Tag': 'noindex, nofollow' } : {}) },
    })
  } catch {
    return new NextResponse('Service unavailable', { status: 503,
      headers: { 'Retry-After': '300', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' } })
  }
}
