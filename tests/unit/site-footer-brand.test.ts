import { describe, expect, it } from 'vitest'
import { siteFooterBrand } from '@/lib/site/footer-brand'
import { resolveSite, type SiteBrand } from '@/lib/site/resolve-site'

const partner: SiteBrand = { id: 'partner', name: 'Partner menus', primary_host: 'partner.example', extra_hosts: [], default_lang: 'en', show_powered_by: true }
const site = (brand: SiteBrand) => resolveSite({ host: brand.primary_host, pathname: '/', tenant: null, brand })

describe('public host attribution', () => {
  it('uses the assigned partner rather than a global platform setting', () => {
    expect(siteFooterBrand(site(partner), 'Xprout')).toBe('Partner menus')
  })
  it('honors brand opt-out and fails closed without resolved identity', () => {
    expect(siteFooterBrand(site({ ...partner, show_powered_by: false }), 'Xprout')).toBe('')
    expect(siteFooterBrand(null, 'Xprout')).toBe('')
  })
  it('preserves the platform administrator attribution setting on its own brand', () => {
    expect(siteFooterBrand(site({ ...partner, id: '00000000-0000-4000-8000-000000000001' }), 'Custom platform footer')).toBe('Custom platform footer')
  })
})
