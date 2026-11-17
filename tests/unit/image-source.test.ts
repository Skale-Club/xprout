import { describe, expect, it } from 'vitest'
import { CARD_VARIANT, cardVariantKey, cardVariantUrl, isAcceptedImageUrl, isManagedImage } from '@/lib/media/image-source'

const stored = 'https://xmartmenu-product-images.skale.club/tenant/menu-images/dish-1.webp'

describe('image source rule', () => {
  it('accepts only optimized WebP from our storage, the app itself or legacy Supabase storage', () => {
    for (const ok of [
      stored,
      'https://xmartmenu-tenant-assets.skale.club/logos/a.webp',
      '/brands/aurora-kitchen-bar/dish.webp',
      'https://project.supabase.co/storage/v1/object/public/product-images/a.webp',
    ]) expect(isAcceptedImageUrl(ok), ok).toBe(true)
  })

  it('refuses heavy formats, other sites and tricks', () => {
    for (const bad of [
      'https://xmartmenu-product-images.skale.club/tenant/dish.jpg',
      'https://xmartmenu-product-images.skale.club/tenant/dish.png',
      'https://images.unsplash.com/photo-1.webp',
      'https://example.com/dish.webp',
      'http://xmartmenu-product-images.skale.club/tenant/dish.webp',
      'https://xmartmenu-product-images.skale.club.evil.example/dish.webp',
      'https://user:pass@xmartmenu-product-images.skale.club/dish.webp',
      'https://xmartmenu-product-images.skale.club/dish.webp?w=9999',
      '//example.com/dish.webp',
      'data:image/webp;base64,abc',
      `${stored}${'a'.repeat(2048)}`,
      42,
      null,
    ]) expect(isAcceptedImageUrl(bad), String(bad)).toBe(false)
  })

  it('names the card sibling next to the stored original', () => {
    expect(cardVariantKey('tenant/menu-images/dish-1.webp')).toBe(`tenant/menu-images/dish-1${CARD_VARIANT.suffix}`)
    expect(cardVariantUrl(stored)).toBe('https://xmartmenu-product-images.skale.club/tenant/menu-images/dish-1.w480.webp')
  })

  it('never makes a sibling of a sibling, a non-WebP file or a non-stored image', () => {
    expect(cardVariantKey('tenant/dish-1.w480.webp')).toBeNull()
    expect(cardVariantKey('tenant/doc.pdf')).toBeNull()
    expect(cardVariantUrl('/brands/aurora-kitchen-bar/dish.webp')).toBeNull()
    expect(cardVariantUrl('https://project.supabase.co/storage/v1/object/public/a.webp')).toBeNull()
    expect(isManagedImage('/brands/aurora-kitchen-bar/dish.webp')).toBe(false)
  })
})
