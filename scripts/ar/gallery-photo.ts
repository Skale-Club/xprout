/**
 * Turns the 3D gallery source photos ($AR_MODELS_DIR/gallery/photos/<id>.png)
 * into the published photo role: WebP, at most 1200px and 100KiB
 * (docs/product/media-policy.md, the shared photo profile). The WebP is both the
 * Rodin reference and the gallery card photo.
 *
 *   npx tsx scripts/ar/gallery-photo.ts <id> [<id> ...]
 *
 * Writes photos/<id>.webp next to the source and prints one JSON line per photo.
 */
import { config } from 'dotenv'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import sharp from 'sharp'

config({ path: resolve(process.cwd(), '.env.local'), quiet: true })

async function main() {
  const { optimizeImageToWebP } = await import('../../src/lib/media/optimize-image')
  const root = process.env.AR_MODELS_DIR
  if (!root) throw new Error('AR_MODELS_DIR is missing from .env.local')
  const ids = process.argv.slice(2)
  if (!ids.length) throw new Error('usage: gallery-photo.ts <id> [<id> ...]')
  for (const id of ids) {
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`bad id ${id}`)
    const source = join(root, 'gallery', 'photos', `${id}.png`)
    const webp = await optimizeImageToWebP(await readFile(source), { profile: 'photo' })
    const out = join(root, 'gallery', 'photos', `${id}.webp`)
    await writeFile(out, webp)
    const meta = await sharp(webp).metadata()
    console.log(JSON.stringify({ id, webp: out, bytes: webp.length, width: meta.width, height: meta.height }))
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1) })
