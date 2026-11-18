import { getPublicMenuBase, withMenuPrices } from './public-menu-data'
import { dishSlug, isIndexableDish } from './dish-pages'
import type { Category, Product } from '@/types/database'
import { displayPrice, sizeGroups, type PricedOptionGroup } from '@/components/menu/showcase'
import { baseName, localizeGroups, localizeItem } from '@/lib/menu-translations'
import type { GroupWithOptions } from '@/app/(admin)/menu/products/[id]/page'

/** Other dishes shown at the foot of a dish page. */
export const RELATED_DISHES = 4

/**
 * Up to `limit` other public dishes of the same menu: the dish's own category first, then the
 * rest, each in menu order. Only dishes that have their own page (each card links to it).
 */
export function relatedDishes(product: Pick<Product, 'id' | 'category_id'>, products: readonly Product[],
  groupsByProductId: Record<string, readonly PricedOptionGroup[] | undefined>, limit = RELATED_DISHES) {
  const others = products.filter(other => other.id !== product.id && isIndexableDish(other))
  const sameCategory = (other: Product) => product.category_id !== null && other.category_id === product.category_id
  const byPosition = (a: Product, b: Product) => a.position - b.position
  return [...others.filter(sameCategory).sort(byPosition), ...others.filter(other => !sameCategory(other)).sort(byPosition)]
    .slice(0, limit)
    // The slug from the base name: a translated name is not the dish page's address.
    .map(other => ({ id: other.id, name: other.name, slug: dishSlug({ id: other.id, name: baseName(other) }), image_url: other.image_url!,
      price: displayPrice(other.price, groupsByProductId[other.id]) }))
}

/**
 * Never return a private menu's product, including for an authenticated guest. With `lang`, the
 * dish, its category, its sizes and the related dishes read in that language (base text when
 * a translation is missing); the slug, prices and the kitchen's base name do not change.
 */
export async function loadPublicDish(slug: string, menuSlug: string, productSlug: string, lang?: string | null) {
  const base = await getPublicMenuBase(slug, menuSlug)
  if (base.kind !== 'menu' || !base.menu || base.menu.is_private !== false || base.menu.is_active === false || base.menu.slug !== menuSlug || base.location) return null
  const priced = withMenuPrices(base)
  const matches = priced.products.filter((product: Product) => dishSlug(product) === productSlug && isIndexableDish(product)) as Product[]
  if (matches.length !== 1) return null
  const baseLang = base.menu.language ?? null
  const localize = <T extends Parameters<typeof localizeItem>[0]>(item: T) => lang ? localizeItem(item, lang, baseLang) : item
  const product = localize(matches[0])
  const groups = priced.optionGroupsByProductId[product.id]
  const category = ((base.categories ?? []) as Category[]).find(item => item.id === product.category_id)
  return { tenant: base.tenant, menu: base.menu, product,
    price: displayPrice(product.price, groups),
    // The dish's 3D model, for the page's own 3D view and "see it on your table".
    arModel: base.productArModelByProductId?.[product.id] ?? null,
    category: category ? localize(category).name : null,
    // Groups that set the price (sizes), shown as a small price list.
    sizes: lang ? localizeGroups(sizeGroups(groups ?? []) as GroupWithOptions[], lang, baseLang) : sizeGroups(groups ?? []),
    // What comes in the dish; extras the guest can add are left out.
    ingredients: (priced.productIngredientsByProductId?.[product.id] ?? []).filter(item => item.is_default && item.ingredient?.name).map(item => item.ingredient.name),
    related: relatedDishes(product, (priced.products as Product[]).map(localize), priced.optionGroupsByProductId) }
}
