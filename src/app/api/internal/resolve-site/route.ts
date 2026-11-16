import { isLoopbackCall } from '@/lib/data/tenant-domain'
import { ownedModeActive } from '@/lib/data/owned-mode'
import { readRequestSite } from '@/lib/site/request-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const options = { headers: { 'Cache-Control': 'no-store' } }
  if (!isLoopbackCall(request.headers)) return Response.json({ error: 'Not found' }, { ...options, status: 404 })
  const url = new URL(request.url)
  const host = url.searchParams.get('host') ?? ''
  const pathname = url.searchParams.get('path') ?? '/'
  if (host.length > 260 || pathname.length > 800 || !pathname.startsWith('/') || /[\\\r\n\0]/.test(pathname)) return Response.json({ error: 'Invalid request' }, { ...options, status: 400 })
  try {
    if (ownedModeActive()) {
      const { ownedAdminTransaction } = await import('@/lib/data/admin-menus-runtime')
      const site = await ownedAdminTransaction(false, query => readRequestSite(query, host, pathname, url.searchParams.get('brand') ?? undefined), 3500)
      return Response.json(site, options)
    }
    const { legacyRequestSite } = await import('@/lib/site/legacy-request')
    return Response.json(await legacyRequestSite(host, pathname), options)
  } catch { return Response.json({ error: 'Unavailable' }, { ...options, status: 503 }) }
}
