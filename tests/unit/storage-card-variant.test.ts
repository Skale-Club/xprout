import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sent: Array<{ name: string; input: Record<string, unknown> }> = []
let headStatus = 404

vi.mock('@aws-sdk/client-s3', () => {
  class Command { constructor(public input: Record<string, unknown>) {} }
  class PutObjectCommand extends Command {}
  class HeadObjectCommand extends Command {}
  class GetObjectCommand extends Command {}
  class S3Client {
    async send(command: Command) {
      const name = command.constructor.name
      sent.push({ name, input: command.input })
      if (name === 'HeadObjectCommand' && headStatus !== 200) throw Object.assign(new Error('missing'), { $metadata: { httpStatusCode: headStatus } })
      if (name === 'GetObjectCommand') return { ContentLength: original.length, Body: (async function* () { yield original })() }
      return {}
    }
  }
  return { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand }
})
vi.mock('@/lib/data/owned-mode', () => ({ assertOwnedModeStorage: () => {} }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => { throw new Error('unused') } }))

let original: Buffer

beforeEach(async () => {
  sent.length = 0
  headStatus = 404
  Object.assign(process.env, {
    STORAGE_PROVIDER: 's3', STORAGE_S3_ENDPOINT: 'https://r2.test', STORAGE_S3_ACCESS_KEY_ID: 'k',
    STORAGE_S3_SECRET_ACCESS_KEY: 's', STORAGE_S3_PUBLIC_URL_BASE: 'https://{bucket}.skale.club',
  })
  original = await sharp({ create: { width: 1200, height: 1200, channels: 3, background: '#a33' } }).webp({ quality: 80 }).toBuffer()
  const { resetStorageClient } = await import('@/lib/storage')
  resetStorageClient()
})
afterEach(() => vi.restoreAllMocks())

const puts = () => sent.filter(c => c.name === 'PutObjectCommand').map(c => c.input)

describe('stored images always get a card sibling', () => {
  it('writes the original and a small WebP sibling in one upload', async () => {
    const { getNativeStorageClient } = await import('@/lib/storage')
    await getNativeStorageClient().upload('product-images', 'tenant/dish.webp', original, { contentType: 'image/webp' })
    const [first, second] = puts()
    expect(first.Key).toBe('tenant/dish.webp')
    expect(second.Key).toBe('tenant/dish.w480.webp')
    expect(second.ContentType).toBe('image/webp')
    const meta = await sharp(second.Body as Buffer).metadata()
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(480)
    expect((second.Body as Buffer).length).toBeLessThanOrEqual(32 * 1024)
  })

  it('leaves other files alone', async () => {
    const { getNativeStorageClient } = await import('@/lib/storage')
    await getNativeStorageClient().upload('tenant-assets', 'docs/menu.pdf', Buffer.from('%PDF'), { contentType: 'application/pdf' })
    await getNativeStorageClient().upload('product-images', 'tenant/dish.w480.webp', original, { contentType: 'image/webp' })
    expect(puts().map(p => p.Key)).toEqual(['docs/menu.pdf', 'tenant/dish.w480.webp'])
  })

  it('backfills a missing sibling and skips an existing one', async () => {
    const { getNativeStorageClient } = await import('@/lib/storage')
    expect(await getNativeStorageClient().ensureCardVariant('product-images', 'tenant/old.webp')).toBe('created')
    expect(puts().map(p => p.Key)).toEqual(['tenant/old.w480.webp'])
    headStatus = 200
    expect(await getNativeStorageClient().ensureCardVariant('product-images', 'tenant/old.webp')).toBe('exists')
    expect(await getNativeStorageClient().ensureCardVariant('product-images', 'tenant/old.jpg')).toBe('skipped')
  })
})
