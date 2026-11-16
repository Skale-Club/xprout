import { describe, expect, it } from 'vitest'
import { PLATFORM_BASE, buildWebSiteJsonLd, resolveOgImageOverride, toPublicAssetUrl } from '@/lib/seo'

describe('toPublicAssetUrl', () => {
  it('moves the legacy host to the platform host and keeps path and query', () => {
    expect(toPublicAssetUrl('https://xmartmenu.skale.club/brands/aurora-kitchen-bar/banner.webp?v=2')).toBe(`${PLATFORM_BASE}/brands/aurora-kitchen-bar/banner.webp?v=2`)
  })
  it('leaves other hosts, lookalikes, relative and empty values untouched', () => {
    for (const url of ['https://xmartmenu-product-images.skale.club/a.webp', 'https://evil.xmartmenu.skale.club/a.webp', 'https://xmartmenu.skale.club.evil.com/a.webp', '/brands/a.webp', 'not a url', '']) {
      expect(toPublicAssetUrl(url)).toBe(url)
    }
    expect(toPublicAssetUrl(null)).toBeNull()
    expect(toPublicAssetUrl(undefined)).toBeUndefined()
  })
  it('is applied to the social image override', () => {
    expect(resolveOgImageOverride({ seo_og_image_url: 'https://xmartmenu.skale.club/x.webp' } as never)).toBe(`${PLATFORM_BASE}/x.webp`)
  })
})

describe('buildWebSiteJsonLd', () => {
  it('does not advertise a site search that does not exist', () => {
    const ld = buildWebSiteJsonLd({ name: 'Xprout', url: PLATFORM_BASE }) as Record<string, unknown>
    expect(ld.potentialAction).toBeUndefined()
    expect(ld['@type']).toBe('WebSite')
  })
})
