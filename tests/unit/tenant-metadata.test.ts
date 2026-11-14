import { describe, expect, it } from 'vitest'
import { tenantMetadata } from '@/lib/tenant-metadata'

describe('tenant browser identity', () => {
  it('uses each company logo for every browser icon without platform fallbacks', () => {
    for (const name of ['Aurora Kitchen & Bar', 'Celes Confections']) {
      const logo = `https://media.example.test/${encodeURIComponent(name)}.webp`
      const metadata = tenantMetadata(name, logo)
      expect(metadata.title).toEqual({ absolute: name, template: '%s' })
      expect(metadata.icons).toEqual({ icon: logo, shortcut: logo, apple: logo })
      expect(JSON.stringify(metadata)).not.toContain('Xprout')
    }
  })

  it('provides a bounded, escaped company monogram when no logo is configured', () => {
    for (const name of ['Aurora Kitchen & Bar', '<script> &', '🧑‍🍳 🥗', 'ß ß']) {
      const metadata = tenantMetadata(name, ' ')
      const icon = (metadata.icons as { icon: string }).icon
      expect(Buffer.byteLength(icon)).toBeLessThanOrEqual(1024)
      const svg = decodeURIComponent(icon.split(',')[1])
      expect(svg).toContain('width="64" height="64"')
      expect(svg).not.toContain('<script>')
      expect(icon).not.toContain('/brand/')
    }
    expect(tenantMetadata('Aurora').icons).not.toEqual(tenantMetadata('Celes').icons)
  })
})
