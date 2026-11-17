import { describe, expect, it } from 'vitest'
import { tenantSitemapCatalog } from '@/lib/data/public-seo'

describe('tenant sitemap catalog', () => {
  it('leaves out a menu with no available dish', () => {
    const catalog = tenantSitemapCatalog([
      { id: 'main', slug: 'main-menu', is_default: true, is_private: false, has_products: true },
      { id: 'drinks', slug: 'drinks', is_default: false, is_private: false, has_products: false },
    ], [])
    expect(catalog.menus.map(menu => menu.slug)).toEqual(['main-menu'])
  })
  it('keeps menus whose stock is unknown', () => {
    const catalog = tenantSitemapCatalog([{ id: 'main', slug: 'main-menu', is_default: true, is_private: false }], [])
    expect(catalog.menus.map(menu => menu.slug)).toEqual(['main-menu'])
  })
})
