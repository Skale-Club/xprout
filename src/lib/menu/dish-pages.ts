import type { Product } from '@/types/database'

export type DishProduct = Pick<Product, 'id' | 'name' | 'description' | 'image_url' | 'is_available' | 'price' | 'tags'>

/** A readable stable suffix disambiguates dishes without a database migration. */
export function dishSlug(product: Pick<DishProduct, 'id' | 'name'>): string {
  const name = product.name.normalize('NFKD').replace(/[\u0300-\u036f]/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '').slice(0, 70).replace(/-$/u, '') || 'dish'
  const id = product.id.replace(/-/gu, '').toLowerCase()
  return `${name}-${id.slice(0, 6)}${id.slice(-6)}`
}

export function isIndexableDish(product: DishProduct): boolean {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(product.id)
    || product.is_available !== true || !product.name.trim() || !product.description?.trim()
    || product.description.trim().toLowerCase() === product.name.trim().toLowerCase()
    || !Number.isFinite(product.price) || product.price < 0 || !product.image_url?.trim()) return false
  try {
    const image = new URL(product.image_url, 'https://local.invalid')
    return image.protocol === 'https:' && !image.username && !image.password
  } catch { return false }
}

export function dishPath(menuSlug: string, product: Pick<DishProduct, 'id' | 'name'>): string {
  return `/${menuSlug}/${dishSlug(product)}`
}

export function dishJsonLd(product: DishProduct, url: string, menuUrl: string, currency: string, imageUrl: string, price = { amount: product.price, from: false }): object {
  return { '@context': 'https://schema.org', '@type': 'MenuItem', '@id': `${url}#dish`,
    name: product.name, description: product.description, image: imageUrl, url,
    isPartOf: { '@type': 'Menu', url: menuUrl },
    offers: price.from ? { '@type': 'AggregateOffer', lowPrice: price.amount.toFixed(2), priceCurrency: currency }
      : { '@type': 'Offer', price: price.amount.toFixed(2), priceCurrency: currency },
    ...(product.tags?.length ? { keywords: product.tags.join(', ') } : {}) }
}

export function branchTitle(tenantName: string, branch: { name: string; city?: string | null }): string {
  return `${tenantName} – ${[branch.name, branch.city].filter(Boolean).join(', ')}: menu, hours and directions`
}

export function branchDescription(tenantName: string, branch: { name: string; city?: string | null; address?: string | null }): string {
  return `Menu, opening hours and directions for ${tenantName} – ${branch.name}${branch.city ? ` in ${branch.city}` : ''}${branch.address ? `, ${branch.address}` : ''}.`
}

export function branchDirectionsUrl(branch: { address?: string | null; city?: string | null; region?: string | null; country?: string | null; latitude?: number | null; longitude?: number | null }): string | null {
  const { latitude, longitude } = branch
  const destination = typeof latitude === 'number' && typeof longitude === 'number' && Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? `${latitude},${longitude}`
    : [branch.address, branch.city, branch.region, branch.country].filter(Boolean).join(', ')
  return destination ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}` : null
}
