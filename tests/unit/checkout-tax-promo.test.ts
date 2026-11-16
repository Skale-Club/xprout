import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OwnedOrderRepository, type OrderQuery } from '@/lib/data/orders'
import {
  bpsToPercent, discountCents, normalizePromoCode, percentToBps, priceOrder, promoRejection, taxCents,
  type PromoCodeRow,
} from '@/lib/orders/tax-promo'
import { parsePromoInput } from '@/lib/orders/promo-admin'

const promo = (over: Partial<PromoCodeRow> = {}): PromoCodeRow => ({
  id: randomUUID(), code: 'WELCOME10', kind: 'percent', value: 10, starts_at: null, ends_at: null, is_active: true, ...over,
})

describe('sales tax', () => {
  it('rounds half up in integer cents (6.25% of 8195 = 512)', () => {
    expect(taxCents(8195, 625)).toBe(512)
    expect(taxCents(1000, 625)).toBe(63) // 62.5 rounds up
    expect(taxCents(1000, 0)).toBe(0)
    expect(taxCents(0, 625)).toBe(0)
  })
  it('converts the typed percent to basis points within 0-25%', () => {
    expect(percentToBps('6.25')).toBe(625)
    expect(percentToBps('6,25')).toBe(625)
    expect(percentToBps('')).toBe(0)
    expect(percentToBps('25')).toBe(2500)
    expect(percentToBps('25.01')).toBeNull()
    expect(percentToBps('-1')).toBeNull()
    expect(percentToBps('1.234')).toBeNull()
    expect(bpsToPercent(625)).toBe('6.25')
    expect(bpsToPercent(800)).toBe('8')
  })
})

describe('promo discount', () => {
  it('applies percent and fixed codes and never exceeds the subtotal', () => {
    expect(discountCents(5000, { kind: 'percent', value: 10 })).toBe(500)
    expect(discountCents(999, { kind: 'percent', value: 15 })).toBe(150) // 149.85 rounds to 150
    expect(discountCents(5000, { kind: 'fixed', value: 700 })).toBe(700)
    expect(discountCents(500, { kind: 'fixed', value: 700 })).toBe(500)
    expect(discountCents(500, { kind: 'percent', value: 100 })).toBe(500)
    expect(discountCents(0, { kind: 'fixed', value: 700 })).toBe(0)
  })
  it('rejects inactive, not-yet-started and expired codes', () => {
    const now = new Date('2026-11-16T12:00:00Z')
    expect(promoRejection(promo(), now)).toBeNull()
    expect(promoRejection(null, now)).toBe('invalid')
    expect(promoRejection(promo({ is_active: false }), now)).toBe('invalid')
    expect(promoRejection(promo({ starts_at: '2026-11-17T00:00:00Z' }), now)).toBe('invalid')
    expect(promoRejection(promo({ ends_at: '2026-11-16T11:00:00Z' }), now)).toBe('invalid')
    expect(promoRejection(promo({ starts_at: '2026-11-01T00:00:00Z', ends_at: '2026-12-01T00:00:00Z' }), now)).toBeNull()
  })
  it('normalizes codes to upper case', () => {
    expect(normalizePromoCode('  welcome10 ')).toBe('WELCOME10')
    expect(normalizePromoCode('a')).toBeNull()
    expect(normalizePromoCode('bad code')).toBeNull()
    expect(normalizePromoCode(5)).toBeNull()
  })
  it('validates what the admin creates', () => {
    expect(parsePromoInput({ code: 'save5', kind: 'fixed', value: 500 })).toMatchObject({ ok: true, value: { code: 'SAVE5', kind: 'fixed', value: 500, starts_at: null, ends_at: null } })
    expect(parsePromoInput({ code: 'x', kind: 'fixed', value: 500 }).ok).toBe(false)
    expect(parsePromoInput({ code: 'SAVE5', kind: 'percent', value: 101 }).ok).toBe(false)
    expect(parsePromoInput({ code: 'SAVE5', kind: 'percent', value: 10, starts_at: '2026-12-02', ends_at: '2026-12-01' }).ok).toBe(false)
  })
})

describe('order total', () => {
  it('is subtotal - discount + tax + delivery + tip, taxing only the discounted items', () => {
    // 8195 subtotal, 10% off = 820 -> 7375 taxable, 6.25% = 461 (460.94), delivery 300, tip 500.
    const priced = priceOrder({ subtotalCents: 8195, promo: promo(), taxBps: 625, deliveryFeeCents: 300, tipCents: 500 })
    expect(priced).toEqual({ discountCents: 820, taxCents: 461, totalCents: 8195 - 820 + 461 + 300 + 500 })
  })
  it('matches the old formula without a code or a rate', () => {
    expect(priceOrder({ subtotalCents: 2500, promo: null, taxBps: 0, deliveryFeeCents: 300, tipCents: 100 }))
      .toEqual({ discountCents: 0, taxCents: 0, totalCents: 2900 })
  })
})

describe('schema not applied yet', () => {
  const tenantId = randomUUID()
  it('reports not ready after one readiness query and reads nothing else', async () => {
    const query = vi.fn<OrderQuery>(async () => ({ rows: [{ ready: false }] }))
    const state = await new OwnedOrderRepository(query, tenantId).taxPromo('WELCOME10')
    expect(state).toEqual({ ready: false, taxBps: 0, promo: null })
    expect(query).toHaveBeenCalledTimes(1)
  })
  it('looks the code up inside the tenant only', async () => {
    const query = vi.fn<OrderQuery>(async (text) => {
      if (text.includes('information_schema.columns')) return { rows: [{ ready: true }] }
      if (text.includes('FROM public.tenant_settings')) return { rows: [{ row: { tax_rate_bps: 625 } }] }
      return { rows: [] }
    })
    const state = await new OwnedOrderRepository(query, tenantId).taxPromo('OTHERS')
    expect(state).toEqual({ ready: true, taxBps: 625, promo: null })
    const lookup = query.mock.calls.find(([text]) => text.includes('FROM public.promo_codes'))!
    expect(lookup[0]).toContain('p.tenant_id=$1 AND p.code=$2')
    expect(lookup[1]).toEqual([tenantId, 'OTHERS'])
  })
})

// POST /api/orders: the route decides discount, tax and total.
const mocks = vi.hoisted(() => ({ effective: vi.fn(), legacy: vi.fn(), cookie: vi.fn(), transaction: vi.fn(), capabilities: vi.fn(),
  stripe: vi.fn(), analytics: vi.fn(), rate: vi.fn(), customer: vi.fn() }))
vi.mock('@/lib/auth/owned-customer-runtime', () => ({ getOwnedCustomer: mocks.customer }))
vi.mock('@/lib/get-effective-tenant', () => ({ getEffectiveTenant: mocks.effective }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.cookie, createServiceClient: mocks.legacy }))
vi.mock('@/lib/tenant-plan', () => ({ getTenantCapabilities: mocks.capabilities }))
vi.mock('@/lib/stripe', () => ({ isStripeEnabled: mocks.stripe }))
vi.mock('@/lib/analytics/server', () => ({ recordTrustedOrderAnalyticsEvent: mocks.analytics }))
vi.mock('@/lib/data/orders-runtime', () => ({ withOwnedOrders: mocks.transaction }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: mocks.rate, getClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/observability/with-api', () => ({ withApi: (_: string, handler: unknown) => handler }))
vi.mock('@/lib/observability/log', () => ({ log: { error: vi.fn() } }))

import { POST as POSTRoute } from '@/app/api/orders/route'

const tenantId = randomUUID(), productId = randomUUID(), menuId = randomUUID(), orderId = randomUUID()
const caps = { kds: true, waiterOrdering: true, guestOrdering: true, dineIn: true, tips: true, itemNotes: true, ingredientCustomization: true }
const result = <T>(data: T) => ({ data, error: null })
const repository = {
  tenantSettings: vi.fn(), capabilities: vi.fn(), stripeEnabled: vi.fn(), products: vi.fn(), optionGroups: vi.fn(), ingredients: vi.fn(),
  deliveryZones: vi.fn(), create: vi.fn(), recordAnalytics: vi.fn(), taxPromo: vi.fn(), recordTaxPromo: vi.fn(),
}
const order = (extra: Record<string, unknown> = {}) => ({
  tenant_id: tenantId, customer_name: 'Guest', customer_phone: '5550100200', tip_cents: 100,
  items: [{ product_id: productId, quantity: 2 }], ...extra,
})
const post = (body: unknown) => POSTRoute(new Request('http://localhost/api/orders', {
  method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'checkout-key-12345' },
}), undefined)

describe('POST /api/orders with tax and a promo code', () => {
  beforeEach(() => {
    vi.stubEnv('OWNED_ORDER_DATA_ENABLED', 'true')
    mocks.rate.mockResolvedValue({ ok: true }); mocks.effective.mockResolvedValue(null)
    mocks.cookie.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) } })
    mocks.transaction.mockImplementation(async (_t: string, _w: boolean, operation: (repo: unknown) => unknown) => operation(repository))
    repository.tenantSettings.mockResolvedValue(result({ id: tenantId, is_active: true, tenant_settings: { orders_enabled: true, currency: 'USD', country: 'US' } }))
    repository.capabilities.mockResolvedValue(caps); repository.stripeEnabled.mockResolvedValue(false)
    // 2 x $10.00 = $20.00 subtotal.
    repository.products.mockResolvedValue(result([{ id: productId, tenant_id: tenantId, name: 'Dish', price: 10, is_available: true, menu_id: menuId,
      menus: { id: menuId, is_active: true, is_private: false, price_multiplier: 1 } }]))
    repository.optionGroups.mockResolvedValue(result([])); repository.ingredients.mockResolvedValue(result([]))
    repository.create.mockResolvedValue(result({ id: orderId, status: 'pending', total: 0, order_type: 'dine_in', replayed: false }))
    repository.taxPromo.mockResolvedValue({ ready: true, taxBps: 625, promo: promo() })
  })
  afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks() })

  it('charges subtotal - discount + tax + tip and stores the breakdown', async () => {
    const response = await post(order({ promo_code: ' welcome10 ' }))
    expect(response.status).toBe(200)
    // $20.00 - 10% ($2.00) = $18.00; 6.25% tax = $1.125 -> 113 cents; tip $1.00 -> $20.13.
    const [row] = repository.create.mock.calls[0]
    expect(row.total).toBe(20.13)
    expect(row.subtotal).toBe(20)
    expect(repository.taxPromo).toHaveBeenCalledWith('WELCOME10')
    expect(repository.recordTaxPromo).toHaveBeenCalledWith(orderId, { discountCents: 200, taxCents: 113, promoCode: 'WELCOME10' })
  })

  it('taxes without a code and ignores any amount the client sends', async () => {
    repository.taxPromo.mockResolvedValue({ ready: true, taxBps: 625, promo: null })
    const response = await post(order({ discount_cents: 9999, tax_cents: 0, total: 1 }))
    expect(response.status).toBe(200)
    expect(repository.create.mock.calls[0][0].total).toBe(22.25) // 2000 + 125 tax + 100 tip
    expect(repository.recordTaxPromo).toHaveBeenCalledWith(orderId, { discountCents: 0, taxCents: 125, promoCode: null })
  })

  it.each([
    ['inactive', promo({ is_active: false })],
    ['expired', promo({ ends_at: '2020-01-01T00:00:00Z' })],
    ['not started', promo({ starts_at: '2999-01-01T00:00:00Z' })],
    ['unknown (also what another tenant\'s code looks like)', null],
  ])('rejects a %s code with a 400 and creates nothing', async (_label, row) => {
    repository.taxPromo.mockResolvedValue({ ready: true, taxBps: 625, promo: row })
    const response = await post(order({ promo_code: 'WELCOME10' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'promo_invalid' })
    expect(repository.create).not.toHaveBeenCalled()
  })

  it('behaves exactly as before while the schema step has not run', async () => {
    repository.taxPromo.mockResolvedValue({ ready: false, taxBps: 0, promo: null })
    const response = await post(order())
    expect(response.status).toBe(200)
    expect(repository.create.mock.calls[0][0].total).toBe(21)
    expect(repository.recordTaxPromo).not.toHaveBeenCalled()
    const withCode = await post(order({ promo_code: 'WELCOME10' }))
    expect(withCode.status).toBe(400)
  })

  it('offers neither tax nor codes when the restaurant does not take guest orders', async () => {
    repository.capabilities.mockResolvedValue({ ...caps, guestOrdering: false })
    const response = await post(order())
    expect(response.status).toBe(403)
    expect(repository.taxPromo).not.toHaveBeenCalled()
  })
})
