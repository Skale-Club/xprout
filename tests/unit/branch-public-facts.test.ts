import { describe, expect, it } from 'vitest'
import { withBranchPublicFacts } from '@/lib/menu/branch-public-facts'

describe('branch public contact facts', () => {
  it('replaces branch NAP/hours while preserving identity, branding and purchase capabilities', () => {
    const tenant = { id: 'merchant', name: 'Merchant', tenant_settings: {
      address: 'Parent address', phone: '+12125550100', city: 'Parent city', business_hours: { mon: '09:00-21:00' },
      logo_url: '/logo.webp', primary_color: '#112233', orders_enabled: false, price_range: '$$', currency: 'EUR',
    } }
    const hours = { mon: '10:00-20:00' }
    const result = withBranchPublicFacts(tenant, { address: '42 Riverside Road', city: 'River City', phone: '+12125550142', latitude: 0, longitude: -73.99, business_hours: hours })
    expect(result).toMatchObject({ id: tenant.id, name: tenant.name, tenant_settings: {
      address: '42 Riverside Road', city: 'River City', phone: '+12125550142', latitude: 0, longitude: -73.99,
      business_hours: hours, logo_url: '/logo.webp', primary_color: '#112233', orders_enabled: false, price_range: '$$', currency: 'EUR',
    } })
    expect(result).not.toBe(tenant)
    expect(result.tenant_settings).not.toBe(tenant.tenant_settings)
    expect(result.tenant_settings.business_hours).not.toBe(hours)
    expect(tenant.tenant_settings.address).toBe('Parent address')
    expect(tenant.tenant_settings.business_hours.mon).toBe('09:00-21:00')
  })
  it('clears missing branch contact facts instead of inventing parent fallbacks', () => {
    const result = withBranchPublicFacts({ tenant_settings: { address: 'Parent address', phone: 'Parent phone', business_hours: { mon: '09:00-21:00' }, logo_url: '/logo.webp' } }, {})
    expect(result.tenant_settings).toEqual({ address: null, phone: null, city: null, region: null, postal_code: null, country: null,
      latitude: null, longitude: null, business_hours: null, logo_url: '/logo.webp' })
  })
  it('handles absent parent settings with only the stored branch facts', () => {
    expect(withBranchPublicFacts({ tenant_settings: null }, { phone: '+12125550142' }).tenant_settings).toMatchObject({ phone: '+12125550142', address: null, business_hours: null })
  })
})
