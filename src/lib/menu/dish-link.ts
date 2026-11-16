/**
 * Shareable dish links (A9): `?dish=<productId>` on the menu URL.
 * Pure string/URL helpers: they keep every other parameter (?table=, ?lang=,
 * ?view=) and work on the platform host and on a restaurant's custom domain,
 * because only the query string is touched.
 */

export const DISH_PARAM = 'dish'

/** `href` with ?dish= set to the product, or removed when null. Other params and the hash are kept. */
export function withDishParam(href: string, productId: string | null): string {
  const url = new URL(href)
  if (productId) url.searchParams.set(DISH_PARAM, productId)
  else url.searchParams.delete(DISH_PARAM)
  return url.toString()
}

/** The dish id asked for by a query string ("?dish=..."), or null. */
export function readDishParam(search: string): string | null {
  const value = new URLSearchParams(search).get(DISH_PARAM)?.trim()
  return value ? value : null
}

/** The product a ?dish= value names; unknown values give null. */
export function findDishByParam<T extends { id: string }>(products: readonly T[], param: string | null): T | null {
  if (!param) return null
  return products.find(p => p.id === param) ?? null
}

/** A link to send someone else: the dish, but never this guest's table or a scroll anchor. */
export function dishShareUrl(href: string, productId: string): string {
  const url = new URL(withDishParam(href, productId))
  url.searchParams.delete('table')
  url.hash = ''
  return url.toString()
}
