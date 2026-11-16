import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TenantSettings } from '@/types/database'
import { buildBranchJsonLd, buildLocalBusinessJsonLd, buildSameAs, parseLocalSeoUpdate, parseSpecialHours } from '@/lib/seo'
import { mutateAdminDisplaySettings, readAdminSeoSettingsPage } from '@/lib/data/admin-display-settings'
import { restaurantLocalSeoCheck } from '@/lib/admin/launch-checklist-scan'

const mocks = vi.hoisted(() => ({ effective: vi.fn(), mutate: vi.fn() }))
vi.mock('@/lib/get-effective-tenant', () => ({ getEffectiveTenant: mocks.effective }))
vi.mock('@/lib/data/admin-display-settings-runtime', () => ({ mutateOwnedDisplaySettings: mocks.mutate }))
vi.mock('@/lib/observability/with-api', () => ({ withApi: (_name: string, handler: unknown) => handler }))
vi.mock('@/lib/observability/log', () => ({ log: { error: vi.fn() } }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => { throw new Error('Unexpected legacy write') } }))
import { PATCH } from '@/app/api/admin/seo/route'

const context = { tenantId: '11111111-1111-4111-8111-111111111111', role: 'store-admin' as const }
const settings = {
  tagline: 'Neighborhood pizza', logo_url: 'https://cdn.example.com/logo.webp', phone: '+1 212 555 0101',
  address: '10 Main Street', city: 'New York', region: 'NY', country: 'US', postal_code: '10001',
  latitude: 40.75, longitude: -73.99, price_range: '$$', business_type: 'Italian',
  business_hours: { mon: '9:00-22:00' }, accepts_reservations: true, reservation_url: 'https://book.example.com/pizza',
  google_business_url: 'https://maps.google.com/?cid=123', google_review_url: 'https://g.page/r/pizza/review',
  facebook: 'https://facebook.com/pizza', tripadvisor: 'https://tripadvisor.com/pizza', yelp: 'https://yelp.com/biz/pizza',
  special_hours: [{ date: '2026-12-25', closed: true }, { date: '2026-12-31', closed: false, opens: '18:00', closes: '02:00' }],
  delivery_enabled: true,
} as TenantSettings
const tenant = { name: 'Pizza', slug: 'pizza' }
const request = (body: unknown, origin = 'https://xprout.app') => new Request('https://xprout.app/api/admin/seo', {
  method: 'PATCH', headers: { host: 'xprout.app', origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
})

beforeEach(() => {
  vi.stubEnv('OWNED_ADMIN_MENUS_ENABLED', 'true')
  mocks.effective.mockResolvedValue(context)
  mocks.mutate.mockResolvedValue({})
})
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })

describe('complete factual Restaurant structured data', () => {
  it('links stable identity, menus, departments, profiles, reservations and delivery area', () => {
    const ld = buildLocalBusinessJsonLd(tenant, settings, 'https://pizza.com', {
      menuUrls: ['https://pizza.com/dinner', 'https://pizza.com/drinks'],
      branches: [{ name: 'Downtown', url: 'https://pizza.com/downtown' }], areaServed: ['Manhattan'],
    })
    expect(ld).toMatchObject({ '@type': 'Restaurant', '@id': 'https://pizza.com#restaurant', name: 'Pizza',
      telephone: settings.phone, address: { streetAddress: '10 Main Street', addressLocality: 'New York' },
      geo: { latitude: 40.75, longitude: -73.99 }, servesCuisine: 'Italian', priceRange: '$$',
      acceptsReservations: 'https://book.example.com/pizza', areaServed: ['Manhattan'],
      hasMenu: ['https://pizza.com/dinner', 'https://pizza.com/drinks'],
      department: [{ '@type': 'Restaurant', '@id': 'https://pizza.com/downtown#restaurant', name: 'Downtown' }],
      openingHoursSpecification: [{ opens: '09:00', closes: '22:00' }],
      specialOpeningHoursSpecification: [
        { validFrom: '2026-12-25', validThrough: '2026-12-25', opens: '00:00', closes: '00:00' },
        { validFrom: '2026-12-31', validThrough: '2026-12-31', opens: '18:00', closes: '02:00' },
      ],
    })
    expect(ld).not.toHaveProperty('aggregateRating')
    expect(ld).not.toHaveProperty('review')
    expect(ld).not.toHaveProperty('mainEntity')
    expect(buildSameAs(settings)).toContain(settings.google_business_url)
    expect(buildSameAs(settings)).not.toContain(settings.google_review_url)
  })

  it('omits unsupported claims and refuses impossible geography', () => {
    const ld = buildLocalBusinessJsonLd(tenant, { ...settings, accepts_reservations: null, delivery_enabled: false, latitude: 120 }, 'https://pizza.com', { areaServed: ['Manhattan'] })
    expect(ld).not.toHaveProperty('acceptsReservations')
    expect(ld).not.toHaveProperty('areaServed')
    expect(ld).not.toHaveProperty('geo')
    expect(buildLocalBusinessJsonLd(tenant, { ...settings, accepts_reservations: false }, 'https://pizza.com')).toHaveProperty('acceptsReservations', false)
  })

  it('links branch identity to the parent entity and inherits reservation policy', () => {
    const ld = buildBranchJsonLd({ name: 'Downtown', address: '10 Main', city: 'New York', phone: '555', business_hours: null },
      'https://pizza.com/downtown', 'https://pizza.com', { acceptsReservations: true, reservationUrl: settings.reservation_url, specialHours: settings.special_hours })
    expect(ld).toMatchObject({ '@id': 'https://pizza.com/downtown#restaurant',
      parentOrganization: { '@id': 'https://pizza.com#restaurant' }, acceptsReservations: settings.reservation_url })
  })
})

describe('local settings validation', () => {
  it('keeps omitted fields absent and normalizes explicit clears', () => {
    expect(parseLocalSeoUpdate({ seo_title: 'Existing client' })).toEqual({ ok: true, value: {} })
    expect(parseLocalSeoUpdate({ facebook: '  ', accepts_reservations: null, special_hours: [] })).toEqual({ ok: true, value: { facebook: null, accepts_reservations: null, special_hours: [] } })
  })
  it.each([
    { facebook: 'javascript:alert(1)' }, { yelp: 'https://user:password@yelp.com' },
    { google_business_url: 'https://maps.google.com/ with spaces' }, { accepts_reservations: 'true' },
    { google_site_verification: '<meta content="anything">' }, { bing_site_verification: 'x'.repeat(257) },
  ])('rejects invalid or unsafe fields %j', body => {
    expect(parseLocalSeoUpdate(body).ok).toBe(false)
  })
  it('checks calendar dates, time ranges, duplicate dates and maximum count', () => {
    for (const value of [
      [{ date: '2026-02-31', closed: true }], [{ date: '2026-12-25', closed: false, opens: '25:00', closes: '26:00' }],
      [{ date: '2026-12-25', closed: true }, { date: '2026-12-25', closed: true }], Array(61).fill({ date: '2026-12-25', closed: true }),
    ]) expect(parseSpecialHours(value)).toBeNull()
    expect(parseSpecialHours([{ date: '2026-12-25', closed: false, opens: '18:00', closes: '02:00' }])).not.toBeNull()
  })
})

describe('schema compatibility and tenant authority', () => {
  it('renders the old SEO settings before the optional schema exists', async () => {
    const query = vi.fn(async (sql: string) => ({ rows: sql.includes('information_schema') ? [{ ready: false }] : [{ has_settings: true, slug: 'pizza', seo_title: 'Pizza' }] }))
    const result = await readAdminSeoSettingsPage(query, context)
    expect(result.settings).toMatchObject({ seo_title: 'Pizza', local_seo_available: false })
    expect(query.mock.calls[1][0]).not.toContain('s.special_hours')
  })
  it('rejects new fields before migration without writing partial settings', async () => {
    const query = vi.fn(async () => ({ rows: [{ ready: false }] }))
    await expect(mutateAdminDisplaySettings(query, context, 'seo', { facebook: 'https://facebook.com/pizza' })).rejects.toMatchObject({ status: 503 })
    expect(query.mock.calls).toHaveLength(1)
  })
  it('scopes validated new values to the owner tenant and serializes special hours as JSON', async () => {
    const query = vi.fn(async (sql: string, _values?: unknown[]) => ({ rows: sql.includes('information_schema') ? [{ ready: true }] : sql.startsWith('INSERT') ? [{ facebook: 'https://facebook.com/pizza' }] : [] }))
    await mutateAdminDisplaySettings(query, context, 'seo', { facebook: 'https://facebook.com/pizza', special_hours: [{ date: '2026-12-25', closed: true }] })
    const write = query.mock.calls.find(([sql]) => sql.startsWith('INSERT'))
    expect(write?.[1]).toEqual([context.tenantId, 'https://facebook.com/pizza', '[{"date":"2026-12-25","closed":true}]'])
    await expect(mutateAdminDisplaySettings(query, { ...context, role: 'store-staff' }, 'seo', { facebook: null })).rejects.toMatchObject({ status: 403 })
  })
  it('supports local-only PATCH without resetting saved base SEO fields', async () => {
    expect((await PATCH(request({ facebook: 'https://facebook.com/pizza' }), undefined)).status).toBe(200)
    expect(mocks.mutate).toHaveBeenCalledWith(context, 'seo', { facebook: 'https://facebook.com/pizza' })
  })
  it('supports old clients without clearing new local settings', async () => {
    await PATCH(request({ seo_title: 'Changed title' }), undefined)
    expect(mocks.mutate).toHaveBeenCalledWith(context, 'seo', { seo_title: 'Changed title' })
  })
  it('rejects invalid input, cross-origin writes and staff before mutation', async () => {
    expect((await PATCH(request({ facebook: 'http://facebook.com/pizza' }), undefined)).status).toBe(400)
    expect((await PATCH(request({ facebook: null }, 'https://evil.com'), undefined)).status).toBe(403)
    mocks.effective.mockResolvedValue({ ...context, role: 'store-staff' })
    expect((await PATCH(request({ facebook: null }), undefined)).status).toBe(403)
    expect(mocks.mutate).not.toHaveBeenCalled()
  })
  it('distinguishes an empty Restaurant tag from complete local SEO evidence', () => {
    expect(restaurantLocalSeoCheck('<script type="application/ld+json">{"@type":"Restaurant"}</script>')).toEqual({ present: true, complete: false })
    const ld = buildLocalBusinessJsonLd(tenant, settings, 'https://pizza.com')
    expect(restaurantLocalSeoCheck(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`)).toEqual({ present: true, complete: true })
  })
})
