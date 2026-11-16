/**
 * The 3D dish gallery (/3d-gallery): a public showcase of every dish we have in
 * 3D, grouped by kind of dish, for demos at restaurants. It is not a
 * restaurant: no prices, no ordering. The rows live in 3d-gallery-dishes.ts.
 */
import { GALLERY_DISHES } from './3d-gallery-dishes'

export const GALLERY_PATH = '/3d-gallery'

/** Gallery order, as a meal is read: starters first, desserts last. */
export const GALLERY_CATEGORIES = [
  { id: 'starters', name: 'Starters & Small Plates' },
  { id: 'burgers-sandwiches', name: 'Burgers & Sandwiches' },
  { id: 'pizza', name: 'Pizza' },
  { id: 'pasta-risotto', name: 'Pasta & Risotto' },
  { id: 'meat-poultry', name: 'Meat & Poultry' },
  { id: 'fish-seafood', name: 'Fish & Seafood' },
  { id: 'asian', name: 'Sushi & Asian' },
  { id: 'mexican', name: 'Mexican' },
  { id: 'vegetarian', name: 'Vegetarian' },
  { id: 'breakfast', name: 'Breakfast & Brunch' },
  { id: 'desserts', name: 'Desserts' },
] as const

export type GalleryCategoryId = (typeof GALLERY_CATEGORIES)[number]['id']

export type GalleryDish = {
  id: string
  name: string
  category: GalleryCategoryId
  /** Free text for the catalog only (risks, sizes to check); never shown. */
  note?: string
} & (
  | { status: 'backlog' }
  | {
      status: 'published'
      /** The model's real width on the table, in cm. */
      widthCm: number
      /** Optimized dish photo (WebP), used as the card and the viewer poster. */
      photo: string
      glb: string
      usdz: string
      /** Where the model was first made (a demo menu slug, or 'gallery'). */
      source: string
    }
)

export type PublishedGalleryDish = Extract<GalleryDish, { status: 'published' }>

export interface GallerySection {
  id: GalleryCategoryId
  name: string
  dishes: PublishedGalleryDish[]
}

/** Published dishes by category, in gallery order; empty categories are left out. */
export function gallerySections(dishes: readonly GalleryDish[] = GALLERY_DISHES): GallerySection[] {
  const published = dishes.filter((dish): dish is PublishedGalleryDish => dish.status === 'published')
  return GALLERY_CATEGORIES
    .map(category => ({
      id: category.id,
      name: category.name,
      dishes: published
        .filter(dish => dish.category === category.id)
        .sort((a, b) => a.name.localeCompare(b.name, 'en')),
    }))
    .filter(section => section.dishes.length > 0)
}
