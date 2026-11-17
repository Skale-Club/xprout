import { getPublicMenuBase, withMenuPrices } from './public-menu-data'
import { dishSlug, isIndexableDish } from './dish-pages'
import type { Product } from '@/types/database'
import { displayPrice } from '@/components/menu/showcase'

/** Never return a private menu's product, including for an authenticated guest. */
export async function loadPublicDish(slug: string, menuSlug: string, productSlug: string) {
  const base = await getPublicMenuBase(slug, menuSlug)
  if (base.kind !== 'menu' || !base.menu || base.menu.is_private !== false || base.menu.is_active === false || base.menu.slug !== menuSlug || base.location) return null
  const priced = withMenuPrices(base)
  const matches = priced.products.filter((product: Product) => dishSlug(product) === productSlug && isIndexableDish(product)) as Product[]
  return matches.length === 1 ? { tenant: base.tenant, menu: base.menu, product: matches[0],
    price: displayPrice(matches[0].price, priced.optionGroupsByProductId[matches[0].id]),
    // The dish's 3D model, for the page's own 3D view and "see it on your table".
    arModel: base.productArModelByProductId?.[matches[0].id] ?? null } : null
}
