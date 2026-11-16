import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { requestSite } from '@/lib/site/request-runtime'
import { BRAND_NAME } from '@/lib/brand'

export const alt = 'Digital menus built for service'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
const asset = join(process.cwd(), 'public/brand/xprout/v1/social-card-1200x630.png')
const MAX_BYTES = 180 * 1024

/** Serve the pre-optimized approved artwork; no request-time image encoding. */
export default async function Image() {
  const site = await requestSite()
  if (site.brand.name !== BRAND_NAME) {
    const generated = new ImageResponse(<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80,
      background: '#18181b', color: '#ffffff', fontSize: 72, fontWeight: 700, textAlign: 'center' }}>{site.brand.name.slice(0,120)}</div>, size)
    const output = new Uint8Array(await generated.arrayBuffer())
    if (output.byteLength > MAX_BYTES) return new Response('Social image exceeds its budget', { status: 503, headers: { 'Cache-Control': 'no-store' } })
    return new Response(output, { headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600', Vary: 'Host' } })
  }
  const info = await stat(asset)
  if (info.size > MAX_BYTES) throw new Error('Platform social image exceeds its media budget')
  const bytes = await readFile(asset)
  if (bytes.length > MAX_BYTES || bytes.length < 24 || bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a'
    || bytes.readUInt32BE(16) !== size.width || bytes.readUInt32BE(20) !== size.height) {
    throw new Error('Invalid platform social image')
  }
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600' } })
}
