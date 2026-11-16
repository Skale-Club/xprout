/**
 * Optional photo on an option choice (product_options.image_url). Admin uploads go
 * through the same /api/admin/products/upload pipeline and budgets as dish photos;
 * only the URL it returns is stored. Reads and writes tolerate the schema step
 * (docs/owned-schema/20261116160000_delivery_rules_option_images.sql) not being
 * applied yet: the column is simply left out.
 */

/** The column exists only after the schema step (owned database). */
export const OPTION_IMAGE_READY_SQL = `SELECT EXISTS (SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='product_options' AND column_name='image_url') AS ready`

/** The option columns to read: the fixed list, plus the photo once the column exists. */
export const optionColumns = (base: string, ready: boolean) => ready ? `${base} image_url` : base

const MAX_URL = 2048

/** A storable photo URL: http(s), no credentials, bounded. */
export function validOptionImageUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_URL) return false
  try {
    const parsed = new URL(value)
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && !parsed.username && !parsed.password
  } catch { return false }
}

/** The photo to show on a choice row, or null (no column yet, no photo, or an unusable value). */
export function optionPhotoUrl(option: { image_url?: unknown } | null | undefined): string | null {
  const value = option?.image_url
  return validOptionImageUrl(value) ? value : null
}
