/**
 * One rule for every image the menu shows (docs/product/media-policy.md):
 *
 * - Stored images live on our R2 buckets as optimized WebP (src/lib/upload.ts) and are served
 *   straight from Cloudflare's edge, never resized again by the app server.
 * - Every stored WebP has a small "card" sibling (`<name>.w480.webp`) written next to it on upload
 *   (src/lib/storage/index.ts) for lists, carts and thumbnails; the original serves the dish window
 *   and the feed. A missing sibling falls back to the original in the browser (DeliveryImage).
 * - A dish can only point at an image that follows this rule (isAcceptedImageUrl).
 *
 * Shared by the server and the browser: no Node APIs here.
 */

export const MANAGED_IMAGE_HOSTS = ['xmartmenu-product-images.skale.club', 'xmartmenu-tenant-assets.skale.club'] as const

/** Lists render dishes at 128–220 CSS px; 480 px stays sharp on 2–3× phone screens. */
export const CARD_VARIANT = { suffix: '.w480.webp', maxSide: 480, maxBytes: 32 * 1024 } as const

function parse(src: string): URL | null {
  try { return new URL(src, 'https://local.invalid') } catch { return null }
}

function isLocalPath(src: string): boolean {
  return src.startsWith('/') && !src.startsWith('//')
}

/** An image stored on our R2 buckets: served as is from the edge, with a card sibling. */
export function isManagedImage(src: string): boolean {
  const url = parse(src)
  return !!url && !isLocalPath(src) && url.protocol === 'https:' && !url.port && !url.search
    && (MANAGED_IMAGE_HOSTS as readonly string[]).includes(url.hostname) && /\.webp$/i.test(url.pathname)
}

/** The storage key of a stored image's card sibling, or null when the key is not a stored WebP original. */
export function cardVariantKey(key: string): string | null {
  if (!/\.webp$/i.test(key) || key.toLowerCase().endsWith(CARD_VARIANT.suffix)) return null
  return key.replace(/\.webp$/i, CARD_VARIANT.suffix)
}

/** The card sibling URL of a stored image, or null for anything else (local assets, legacy hosts). */
export function cardVariantUrl(src: string): string | null {
  if (!isManagedImage(src)) return null
  const url = new URL(src)
  const key = cardVariantKey(url.pathname)
  return key ? `${url.origin}${key}` : null
}

/**
 * The only image URLs a dish may point at: our stored WebP, the app's own WebP assets, or the legacy
 * Supabase public storage kept for rollback. Anything else (a raw JPEG, another site) is refused on save,
 * so no path (admin, MCP, scripts, another AI) can slip a heavy image into the menu.
 */
export function isAcceptedImageUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  const url = parse(value)
  if (!url || url.username || url.password || !/\.webp$/i.test(url.pathname)) return false
  if (isLocalPath(value)) return true
  if (url.protocol !== 'https:' || url.port) return false
  if ((MANAGED_IMAGE_HOSTS as readonly string[]).includes(url.hostname)) return !url.search
  return /^[^.]+\.supabase\.co$/.test(url.hostname) && url.pathname.startsWith('/storage/v1/object/public/')
}

/** Sources next/image may still resize on the app server (local assets and allowed legacy hosts). */
export function canOptimizeImage(src: unknown): boolean {
  if (typeof src !== 'string') return true
  const url = parse(src)
  if (!url) return false
  if (/\.svg$/i.test(url.pathname)) return false
  if (isLocalPath(src)) {
    return !url.search || (url.pathname.startsWith('/brands/celes-confections/') && url.search === '?v=20261029')
  }
  if (url.protocol !== 'https:' || url.port) return false
  // Stored images are already sized and compressed: the edge serves them faster than a resize can.
  if (isManagedImage(src)) return false
  if ((MANAGED_IMAGE_HOSTS as readonly string[]).includes(url.hostname) || url.hostname === 'images.unsplash.com') return true
  return /^[^.]+\.supabase\.co$/.test(url.hostname) && url.pathname.startsWith('/storage/v1/object/public/')
}
