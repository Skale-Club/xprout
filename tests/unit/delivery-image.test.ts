import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DeliveryImage } from '@/components/delivery-image'
import { canOptimizeImage } from '@/lib/media/image-source'

type Props = Parameters<typeof DeliveryImage>[0]
const render = (props: Props) => renderToStaticMarkup(createElement(DeliveryImage, props))

describe('responsive image delivery', () => {
  it.each([
    '/icon.png',
    '/brands/celes-confections/menu.webp?v=20261029',
    'https://xmartmenu-product-images.skale.club/products/a.jpg',
    'https://project.supabase.co/storage/v1/object/public/blog/a.png',
    'https://images.unsplash.com/photo-1?w=1200',
  ])('optimizes an allowed raster source: %s', src => {
    expect(canOptimizeImage(src)).toBe(true)
  })

  it.each([
    'https://legacy.example.com/logo.png',
    'https://xmartmenu-tenant-assets.skale.club.evil.example/logo.png',
    'http://xmartmenu-tenant-assets.skale.club/logo.png',
    'https://project.supabase.co/private/logo.png',
    'https://nested.project.supabase.co/storage/v1/object/public/logo.png',
    'https://images.unsplash.com:8443/photo.jpg',
    '/logo.SVG?v=2',
    'https://xmartmenu-tenant-assets.skale.club/logo.svg?v=2',
    '/icon.png?v=unsupported',
    'blob:https://example.com/123',
    'data:image/png;base64,abc',
    // Stored WebP is already sized: the edge serves it, the app server never resizes it again.
    'https://xmartmenu-tenant-assets.skale.club/logos/a.webp',
  ])('preserves direct delivery for unsupported sources and vectors: %s', src => {
    expect(canOptimizeImage(src)).toBe(false)
  })

  it('retains logo dimensions and generates small density variants', () => {
    const html = render({ src: '/icon.png', alt: '', width: 48, height: 48, sizes: '48px' })
    expect(html).toContain('width="48"')
    expect(html).toContain('w=48&amp;')
    expect(html).toContain('w=96&amp;')
  })

  it('retains cover layout sizing for mobile source selection', () => {
    const sizes = '(max-width: 767px) calc(100vw - 32px), 720px'
    const html = render({ src: '/cover.webp', alt: '', width: 1200, height: 675, sizes })
    expect(html).toContain(`sizes="${sizes}"`)
    expect(html).toContain('640w')
  })

  it('does not send arbitrary legacy URLs to the Next optimizer', () => {
    const src = 'https://legacy.example.com/logo.png'
    const html = render({ src, alt: '', width: 48, height: 48, sizes: '48px' })
    expect(html).toContain(`src="${src}"`)
    expect(html).not.toContain('srcSet')
    expect(html).not.toContain('srcset')
  })

  it('serves a stored image straight from the edge, and its card sibling for lists', () => {
    const src = 'https://xmartmenu-product-images.skale.club/t/menu/dish.webp'
    const full = render({ src, alt: '', fill: true, sizes: '100vw' })
    expect(full).toContain(`src="${src}"`)
    expect(full).not.toContain('_next/image')
    const card = render({ src, alt: '', fill: true, sizes: '160px', variant: 'card' })
    expect(card).toContain('src="https://xmartmenu-product-images.skale.club/t/menu/dish.w480.webp"')
  })
})
