import { describe, expect, it } from 'vitest'
import { GALLERY_CATEGORIES, gallerySections, type GalleryDish } from '@/lib/marketing/3d-gallery'
import { GALLERY_DISHES } from '@/lib/marketing/3d-gallery-dishes'
import { RESERVED_PATHS } from '@/lib/marketing/reserved-paths'

const published = (id: string, name: string, category: GalleryDish['category']): GalleryDish => ({
  id, name, category, status: 'published', widthCm: 28, photo: `https://x.test/${id}.webp`, glb: `https://x.test/${id}.glb`, usdz: `https://x.test/${id}.usdz`, source: 'gallery',
})

describe('3D gallery catalog', () => {
  it('shows only published dishes, in gallery category order, A to Z inside each', () => {
    const sections = gallerySections([
      published('tiramisu', 'Tiramisu', 'desserts'),
      { id: 'ramen', name: 'Ramen', category: 'asian', status: 'backlog' },
      published('burger', 'Burger', 'burgers-sandwiches'),
      published('affogato', 'Affogato', 'desserts'),
    ])
    expect(sections.map(section => section.id)).toEqual(['burgers-sandwiches', 'desserts'])
    expect(sections[1].dishes.map(dish => dish.id)).toEqual(['affogato', 'tiramisu'])
  })

  it('keeps every row valid: unique ids, known categories, https model and photo URLs', () => {
    const ids = GALLERY_DISHES.map(dish => dish.id)
    expect(new Set(ids).size).toBe(ids.length)
    const categories = new Set<string>(GALLERY_CATEGORIES.map(category => category.id))
    for (const dish of GALLERY_DISHES) {
      expect(categories.has(dish.category)).toBe(true)
      if (dish.status !== 'published') continue
      for (const url of [dish.photo, dish.glb, dish.usdz]) expect(url).toMatch(/^https:\/\//)
      expect(dish.glb).toMatch(/\.glb$/)
      expect(dish.usdz).toMatch(/\.usdz$/)
      expect(dish.widthCm).toBeGreaterThan(5)
    }
  })

  it('reserves its path so no restaurant can take it', () => {
    expect(RESERVED_PATHS.has('3d-gallery')).toBe(true)
  })
})
