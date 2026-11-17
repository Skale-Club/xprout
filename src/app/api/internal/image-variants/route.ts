/**
 * POST { limit?, after? } — writes the missing card siblings (`<name>.w480.webp`) of dish images that
 * were stored before every upload made one (src/lib/media/image-source.ts), or that reached storage
 * outside the app. Safe to run again: existing siblings are only checked, never rewritten.
 *
 * Pages through the stored dish images in URL order: pass the returned `next` as `after` until it is null.
 * Guarded like the other internal routes by MENU_REVALIDATE_SECRET in `x-revalidate-secret`; with the
 * variable unset the route does not exist (404).
 */
import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { sharedRuntimePool } from '@/lib/data/shared-pool'
import { isManagedImage } from '@/lib/media/image-source'
import { withApi } from '@/lib/observability/with-api'
import { getNativeStorageClient, type StorageBucket } from '@/lib/storage'

export const maxDuration = 300

const BUCKET_BY_HOST: Record<string, StorageBucket> = {
  'xmartmenu-product-images.skale.club': 'product-images',
  'xmartmenu-tenant-assets.skale.club': 'tenant-assets',
}

function secretMatches(given: string | null, expected: string): boolean {
  if (!given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function handlePOST(request: Request) {
  const expected = process.env.MENU_REVALIDATE_SECRET
  if (!expected) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!secretMatches(request.headers.get('x-revalidate-secret'), expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json().catch(() => ({})) as { limit?: unknown; after?: unknown }
  const limit = Number.isInteger(body.limit) && (body.limit as number) > 0 ? Math.min(body.limit as number, 200) : 50
  const after = typeof body.after === 'string' ? body.after : ''

  const { rows } = await sharedRuntimePool('PUBLIC_MENU').query<{ url: string }>(`
    select distinct url from (
      select unnest(array[image_url, feed_image_url] || coalesce(image_urls, '{}')) as url from products
    ) images
    where url is not null and url > $1
    order by url
    limit $2`, [after, limit])

  const storage = getNativeStorageClient()
  const counts = { created: 0, exists: 0, skipped: 0, failed: 0 }
  const failed: string[] = []
  for (const { url } of rows) {
    if (!isManagedImage(url)) { counts.skipped++; continue }
    const parsed = new URL(url)
    const result = await storage.ensureCardVariant(BUCKET_BY_HOST[parsed.hostname], decodeURIComponent(parsed.pathname.slice(1)))
    counts[result]++
    if (result === 'failed') failed.push(url)
  }
  return NextResponse.json({ ok: true, ...counts, failed, next: rows.length === limit ? rows[rows.length - 1].url : null })
}

export const POST = withApi('POST /api/internal/image-variants', handlePOST)
