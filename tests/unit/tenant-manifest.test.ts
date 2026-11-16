import { describe, expect, it } from 'vitest'
import { buildTenantManifest, isTenantCustomDomainHost } from '@/lib/tenant-manifest'
import { tenantMetadata } from '@/lib/tenant-metadata'

const tenant = { slug: 'aurora', name: 'Aurora Kitchen', logoUrl: 'https://cdn.example.test/aurora.webp', primaryColor: '#c2410c' }

describe('tenant web app manifest', () => {
  it('uses the restaurant identity, colour, logo and menu root', () => {
    const m = buildTenantManifest(tenant, 'xprout.app')
    expect(m).toMatchObject({ name: 'Aurora Kitchen', start_url: '/aurora', scope: '/aurora', theme_color: '#c2410c' })
    expect(m.icons?.[0]).toMatchObject({ src: tenant.logoUrl, type: 'image/webp' })
    expect(JSON.stringify(m)).not.toContain('Xprout')
  })

  it('starts at the root on the verified custom domain only', () => {
    const t = { ...tenant, customDomain: 'menu.aurora.test', customDomainVerified: true }
    expect(buildTenantManifest(t, 'menu.aurora.test:443')).toMatchObject({ start_url: '/', scope: '/' })
    expect(buildTenantManifest(t, 'xprout.app').start_url).toBe('/aurora')
    expect(isTenantCustomDomainHost('menu.aurora.test', { ...t, customDomainVerified: false })).toBe(false)
  })

  it('falls back to a monogram icon and the brand colour without logo or colour', () => {
    const m = buildTenantManifest({ slug: 'a', name: 'Aurora', logoUrl: ' ', primaryColor: 'nope' })
    expect(m.icons?.[0].src.startsWith('data:image/svg+xml')).toBe(true)
    expect(m.theme_color).toBe('#283F32')
  })

  it('links the manifest and sets the Apple title per restaurant', () => {
    const md = tenantMetadata('Aurora', null, 'aurora')
    expect(md.manifest).toBe('/aurora/manifest.webmanifest')
    expect(md.appleWebApp).toMatchObject({ title: 'Aurora' })
    expect(tenantMetadata('Aurora').manifest).toBeUndefined()
  })
})
