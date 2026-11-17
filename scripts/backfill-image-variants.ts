/**
 * Writes the missing card siblings (`<name>.w480.webp`, src/lib/media/image-source.ts) for every WebP
 * already stored in a bucket: images uploaded before every upload made one, or put on R2 outside the app.
 * Existing siblings are never rewritten, so it is safe to run again.
 *
 *   STORAGE_S3_* env (same as the app)  npx tsx scripts/backfill-image-variants.ts [--bucket=product-images] [--apply]
 *
 * Without --apply it only counts. Reads the whole object list first (keys only), then works 3 at a time.
 */
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { cardVariantKey } from '../src/lib/media/image-source'
import { makeCardVariant } from '../src/lib/media/optimize-image'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const bucketArg = args.find(a => a.startsWith('--bucket='))?.split('=')[1] ?? 'product-images'
const bucket = bucketArg === 'tenant-assets'
  ? process.env.STORAGE_S3_BUCKET_TENANT_ASSETS ?? 'xmartmenu-tenant-assets'
  : process.env.STORAGE_S3_BUCKET_PRODUCT_IMAGES ?? 'xmartmenu-product-images'

for (const name of ['STORAGE_S3_ENDPOINT', 'STORAGE_S3_ACCESS_KEY_ID', 'STORAGE_S3_SECRET_ACCESS_KEY']) {
  if (!process.env[name]) throw new Error(`${name} is required`)
}
const s3 = new S3Client({
  endpoint: process.env.STORAGE_S3_ENDPOINT,
  region: process.env.STORAGE_S3_REGION ?? 'auto',
  credentials: { accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID!, secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY! },
  forcePathStyle: true,
})

async function listKeys(): Promise<Set<string>> {
  const keys = new Set<string>()
  let token: string | undefined
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }))
    for (const object of page.Contents ?? []) if (object.Key) keys.add(object.Key)
    token = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (token)
  return keys
}

async function readObject(key: string): Promise<Buffer> {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  if ((response.ContentLength ?? 0) > 5 * 1024 * 1024) throw new Error('original larger than 5 MB')
  const chunks: Uint8Array[] = []
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) chunks.push(chunk)
  return Buffer.concat(chunks)
}

async function main() {
  const keys = await listKeys()
  const missing = [...keys].flatMap(key => {
    const sibling = cardVariantKey(key)
    return sibling && !keys.has(sibling) ? [{ key, sibling }] : []
  })
  console.log(JSON.stringify({ bucket, objects: keys.size, missingSiblings: missing.length, apply }))
  if (!apply) return

  let created = 0, bytes = 0
  const failed: string[] = []
  const queue = [...missing]
  await Promise.all(Array.from({ length: 3 }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      try {
        const body = await makeCardVariant(await readObject(item.key))
        await s3.send(new PutObjectCommand({ Bucket: bucket, Key: item.sibling, Body: body, ContentType: 'image/webp' }))
        created++; bytes += body.length
      } catch (error) {
        failed.push(`${item.key}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }))
  console.log(JSON.stringify({ created, averageKiB: created ? Math.round(bytes / created / 1024) : 0, failed }))
  if (failed.length) process.exitCode = 1
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1) })
