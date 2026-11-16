import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { requestSite } from './request-runtime'
import { getTenantBySlug } from '../menu/public-menu-data'
import { tenantMonogramIcon } from '../tenant-metadata'
import { PLATFORM_BRAND_ASSETS } from '../platform-brand'

/** Explicit logo budget; partner/tenant fallback is a bounded SVG, never Xprout artwork. */
export async function siteIconResponse(request: Request, apple = false): Promise<Response> {
  const site = await requestSite()
  const tenant = site.tenant ? await getTenantBySlug(site.tenant.slug) : null
  const name = tenant?.name ?? site.brand.name
  const configured = tenant?.tenant_settings?.logo_url ?? site.brand.icon
  const headers = { 'Cache-Control': 'public, max-age=3600', Vary: 'Host' }
  if (!tenant && site.brand.id === '00000000-0000-4000-8000-000000000001') {
    const asset = join(process.cwd(), 'public', apple ? PLATFORM_BRAND_ASSETS.apple : PLATFORM_BRAND_ASSETS.icon)
    if ((await stat(asset)).size > 40 * 1024) throw new Error('Icon exceeds logo budget')
    const source = await readFile(asset)
    if (source.byteLength > 40 * 1024 || source.length < 24 || source.toString('hex',0,8)!=='89504e470d0a1a0a'
      || source.readUInt32BE(16)>512 || source.readUInt32BE(20)>512) throw new Error('Icon exceeds logo budget or has invalid PNG dimensions')
    const bytes = new Uint8Array(source)
    return new Response(bytes, { headers: { ...headers, 'Content-Type': 'image/png' } })
  }
  if (configured) {
    try {
      const target = new URL(configured, site.origin)
      const current = new URL(request.url)
      if (target.protocol === 'https:' && !target.username && !target.password && target.href !== current.href
        && !['/icon.png','/apple-icon.png'].includes(target.pathname)) return new Response(null, { status: 307, headers: { ...headers, Location: target.href } })
    } catch { /* A missing/bad stored logo uses the tenant monogram. */ }
  }
  const svg = decodeURIComponent(tenantMonogramIcon(name).slice('data:image/svg+xml,'.length))
  if (Buffer.byteLength(svg) > 4096) throw new Error('Monogram exceeds icon budget')
  return new Response(svg, { headers: { ...headers, 'Content-Type': 'image/svg+xml; charset=utf-8' } })
}
