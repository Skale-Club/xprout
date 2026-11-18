import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OrderDataError, type OrderQuery } from '@/lib/data/orders'
import { readLoyaltyState, redeemLoyalty, settleLoyalty } from '@/lib/data/loyalty'
import {
  LOYALTY_NOT_READY, amountToCents, canRedeem, centsToAmount, loyaltySettingsValid, pointsEarned, redeemRejection, rewardDiscountCents, rewardProgress,
  type LoyaltyState,
} from '@/lib/orders/loyalty'

const state = (over: Partial<LoyaltyState> = {}): LoyaltyState => ({ ready: true, enabled: true, centsPerPoint: 500, rewardPoints: 20, rewardCents: 1000, balance: 25, ...over })

describe('points and reward rules', () => {
  it('earns floor((subtotal - discount) / cents per point), in integer cents', () => {
    expect(pointsEarned(2000, 0, 500)).toBe(4)
    expect(pointsEarned(2499, 0, 500)).toBe(4)
    expect(pointsEarned(2500, 0, 500)).toBe(5)
    expect(pointsEarned(2500, 1000, 500)).toBe(3) // the discount does not earn
    expect(pointsEarned(1000, 1000, 500)).toBe(0)
    expect(pointsEarned(1000, 2000, 500)).toBe(0)
    expect(pointsEarned(1000, 0, 0)).toBe(0)
    expect(pointsEarned(Number.NaN, 0, 500)).toBe(0)
  })
  it('caps the reward discount at the items subtotal', () => {
    expect(rewardDiscountCents(5000, 1000)).toBe(1000)
    expect(rewardDiscountCents(600, 1000)).toBe(600)
    expect(rewardDiscountCents(0, 1000)).toBe(0)
  })
  it('validates the program numbers with the schema bounds', () => {
    expect(loyaltySettingsValid({ centsPerPoint: 500, rewardPoints: 20, rewardCents: 1000 })).toBe(true)
    expect(loyaltySettingsValid({ centsPerPoint: 99, rewardPoints: 20, rewardCents: 1000 })).toBe(false)
    expect(loyaltySettingsValid({ centsPerPoint: 100_001, rewardPoints: 20, rewardCents: 1000 })).toBe(false)
    expect(loyaltySettingsValid({ centsPerPoint: 500, rewardPoints: 0, rewardCents: 1000 })).toBe(false)
    expect(loyaltySettingsValid({ centsPerPoint: 500, rewardPoints: 20, rewardCents: 1_000_001 })).toBe(false)
    expect(loyaltySettingsValid({ centsPerPoint: 5.5, rewardPoints: 20, rewardCents: 1000 })).toBe(false)
  })
  it('converts typed dollars to cents and back', () => {
    expect(amountToCents('5')).toBe(500)
    expect(amountToCents('12.5')).toBe(1250)
    expect(amountToCents('12,50')).toBe(1250)
    expect(amountToCents('1.234')).toBeNull()
    expect(amountToCents('abc')).toBeNull()
    expect(centsToAmount(500)).toBe('5')
    expect(centsToAmount(1250)).toBe('12.50')
  })
  it('shows progress to the reward and when it is ready', () => {
    expect(rewardProgress(12, 20)).toEqual({ current: 12, target: 20, ready: false })
    expect(rewardProgress(35, 20)).toEqual({ current: 20, target: 20, ready: true })
  })
})

describe('who can redeem', () => {
  it('needs a signed-in customer with enough points', () => {
    expect(redeemRejection({ state: state(), signedIn: true, promoTyped: false })).toBeNull()
    expect(canRedeem(state(), true)).toBe(true)
    expect(redeemRejection({ state: state({ balance: 19 }), signedIn: true, promoTyped: false })).toBe('insufficient')
    expect(canRedeem(state({ balance: 19 }), true)).toBe(false)
  })
  it('refuses guests', () => {
    expect(redeemRejection({ state: state({ balance: 0 }), signedIn: false, promoTyped: false })).toBe('sign_in')
    expect(canRedeem(state(), false)).toBe(false)
  })
  it('cannot be combined with a promo code (one discount per order)', () => {
    expect(redeemRejection({ state: state(), signedIn: true, promoTyped: true })).toBe('with_promo')
  })
  it('is unavailable when the program is off or the schema is not applied', () => {
    expect(redeemRejection({ state: state({ enabled: false }), signedIn: true, promoTyped: false })).toBe('unavailable')
    expect(redeemRejection({ state: LOYALTY_NOT_READY, signedIn: true, promoTyped: false })).toBe('unavailable')
  })
})

// A tiny in-memory ledger behind the OrderQuery interface: enough to exercise the idempotent hooks.
function fakeDatabase(options: { ready?: boolean; order?: Record<string, unknown>; settings?: Record<string, unknown> } = {}) {
  const tenantId = randomUUID(), customerId = randomUUID(), orderId = randomUUID()
  const ledger: Array<{ customer_id: string; order_id: string | null; kind: string; points: number }> = []
  const order: Record<string, unknown> = { customer_id: customerId, subtotal: '20.00', discount_cents: 0, loyalty_points_redeemed: 0, ...options.order }
  const settings = { enabled: true, cpp: 500, rp: 20, rc: 1000, ...options.settings }
  const query = vi.fn<OrderQuery>(async (text, values = []) => {
    if (text.includes('information_schema.columns')) return { rows: [{ ready: options.ready !== false }] }
    if (text.includes('FROM public.tenant_settings')) return { rows: [settings] }
    if (text.includes('sum(points)')) return { rows: [{ balance: ledger.filter(row => row.customer_id === values[1]).reduce((sum, row) => sum + row.points, 0) }] }
    if (text.includes('FROM public.orders')) return { rows: [order] }
    if (text.includes('UPDATE public.orders')) { order.loyalty_points_redeemed = values[3]; return { rows: [{ id: orderId }] } }
    if (text.startsWith('INSERT INTO public.loyalty_ledger')) {
      const kind = /'(earn|redeem|refund|reverse)'/.exec(text)![1]
      const exists = (id: unknown) => ledger.some(row => row.order_id === id && row.kind === kind)
      if (kind === 'reverse') {
        const earned = ledger.find(row => row.order_id === values[1] && row.kind === 'earn')
        if (!earned || exists(values[1])) return { rows: [] }
        ledger.push({ customer_id: earned.customer_id, order_id: earned.order_id, kind, points: -earned.points })
        return { rows: [{ points: -earned.points }] }
      }
      if (exists(values[2])) return { rows: [] }
      ledger.push({ customer_id: String(values[1]), order_id: String(values[2]), kind, points: Number(values[3]) })
      return { rows: [{ id: randomUUID() }] }
    }
    return { rows: [] } // advisory lock and savepoints
  })
  const balance = () => ledger.filter(row => row.customer_id === customerId).reduce((sum, row) => sum + row.points, 0)
  return { query, tenantId, customerId, orderId, ledger, order, balance }
}

describe('earning and giving back points', () => {
  it('credits points once, however many times the hook runs', async () => {
    const db = fakeDatabase()
    expect(await settleLoyalty(db.query, db.tenantId, db.orderId, 'done')).toEqual({ earned: 4, refunded: 0, reversed: 0 })
    expect(await settleLoyalty(db.query, db.tenantId, db.orderId, 'done')).toEqual({ earned: 0, refunded: 0, reversed: 0 })
    expect(db.ledger).toHaveLength(1)
    expect(db.balance()).toBe(4)
  })
  it('earns on the items after discounts', async () => {
    const db = fakeDatabase({ order: { subtotal: '20.00', discount_cents: 1000 } })
    expect((await settleLoyalty(db.query, db.tenantId, db.orderId, 'done')).earned).toBe(2)
  })
  it('never earns for a cancelled order', async () => {
    const db = fakeDatabase()
    expect(await settleLoyalty(db.query, db.tenantId, db.orderId, 'cancelled')).toEqual({ earned: 0, refunded: 0, reversed: 0 })
    expect(db.ledger).toHaveLength(0)
  })
  it('gives back the points a cancelled order had redeemed, once', async () => {
    const db = fakeDatabase()
    db.ledger.push({ customer_id: db.customerId, order_id: null, kind: 'earn', points: 30 })
    await redeemLoyalty(db.query, db.tenantId, db.orderId, db.customerId, 20)
    expect(db.balance()).toBe(10)
    expect((await settleLoyalty(db.query, db.tenantId, db.orderId, 'cancelled')).refunded).toBe(20)
    expect((await settleLoyalty(db.query, db.tenantId, db.orderId, 'cancelled')).refunded).toBe(0)
    expect(db.balance()).toBe(30)
  })
  it('reverses a credit when an order that earned is later cancelled', async () => {
    const db = fakeDatabase()
    await settleLoyalty(db.query, db.tenantId, db.orderId, 'done')
    expect((await settleLoyalty(db.query, db.tenantId, db.orderId, 'cancelled')).reversed).toBe(4)
    expect((await settleLoyalty(db.query, db.tenantId, db.orderId, 'cancelled')).reversed).toBe(0)
    expect(db.balance()).toBe(0)
  })
  it('skips guest orders, other statuses, a switched-off program and an unapplied schema', async () => {
    const guest = fakeDatabase({ order: { customer_id: null } })
    expect((await settleLoyalty(guest.query, guest.tenantId, guest.orderId, 'done')).earned).toBe(0)
    const other = fakeDatabase()
    await settleLoyalty(other.query, other.tenantId, other.orderId, 'preparing')
    expect(other.query).not.toHaveBeenCalled()
    const off = fakeDatabase({ settings: { enabled: false } })
    expect((await settleLoyalty(off.query, off.tenantId, off.orderId, 'done')).earned).toBe(0)
    const notReady = fakeDatabase({ ready: false })
    expect(await settleLoyalty(notReady.query, notReady.tenantId, notReady.orderId, 'done')).toEqual({ earned: 0, refunded: 0, reversed: 0 })
    expect(notReady.query).toHaveBeenCalledTimes(1)
  })
  it('never blocks the kitchen: a failure inside the hook is rolled back to its savepoint', async () => {
    const db = fakeDatabase()
    const base = db.query.getMockImplementation()!
    db.query.mockImplementation(async (text, values) => {
      if (text.startsWith('INSERT INTO public.loyalty_ledger')) throw new Error('permission denied')
      return base(text, values)
    })
    await expect(settleLoyalty(db.query, db.tenantId, db.orderId, 'done')).resolves.toEqual({ earned: 0, refunded: 0, reversed: 0 })
    expect(db.query.mock.calls.map(([text]) => text)).toContain('ROLLBACK TO SAVEPOINT loyalty_settle')
  })
})

describe('redeeming', () => {
  it('requires the balance, checked after the per-customer lock', async () => {
    const db = fakeDatabase()
    db.ledger.push({ customer_id: db.customerId, order_id: null, kind: 'earn', points: 19 })
    await expect(redeemLoyalty(db.query, db.tenantId, db.orderId, db.customerId, 20)).rejects.toMatchObject({ status: 409 })
    expect(db.ledger).toHaveLength(1)
    const texts = db.query.mock.calls.map(([text]) => text)
    expect(texts.findIndex(text => text.includes('pg_advisory_xact_lock'))).toBeLessThan(texts.findIndex(text => text.includes('sum(points)')))
  })
  it('cannot spend the same points on two orders', async () => {
    const db = fakeDatabase()
    db.ledger.push({ customer_id: db.customerId, order_id: null, kind: 'earn', points: 25 })
    await redeemLoyalty(db.query, db.tenantId, randomUUID(), db.customerId, 20)
    await expect(redeemLoyalty(db.query, db.tenantId, randomUUID(), db.customerId, 20)).rejects.toBeInstanceOf(OrderDataError)
    expect(db.balance()).toBe(5)
  })
  it('records the points on the order and one redeem row', async () => {
    const db = fakeDatabase()
    db.ledger.push({ customer_id: db.customerId, order_id: null, kind: 'earn', points: 25 })
    await redeemLoyalty(db.query, db.tenantId, db.orderId, db.customerId, 20)
    expect(db.order.loyalty_points_redeemed).toBe(20)
    expect(db.ledger.filter(row => row.kind === 'redeem')).toEqual([{ customer_id: db.customerId, order_id: db.orderId, kind: 'redeem', points: -20 }])
  })
})

describe('schema not applied yet', () => {
  it('reports not ready after one readiness query and reads nothing else', async () => {
    const db = fakeDatabase({ ready: false })
    expect(await readLoyaltyState(db.query, db.tenantId, db.customerId)).toEqual(LOYALTY_NOT_READY)
    expect(db.query).toHaveBeenCalledTimes(1)
  })
  it('reads the program and the balance once it is applied; a guest has none', async () => {
    const db = fakeDatabase()
    db.ledger.push({ customer_id: db.customerId, order_id: null, kind: 'earn', points: 12 })
    expect(await readLoyaltyState(db.query, db.tenantId, db.customerId)).toEqual({ ready: true, enabled: true, centsPerPoint: 500, rewardPoints: 20, rewardCents: 1000, balance: 12 })
    expect((await readLoyaltyState(db.query, db.tenantId, null)).balance).toBe(0)
  })
})

// POST /api/orders: the route decides the discount and the points.
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

const tenantId = randomUUID(), productId = randomUUID(), menuId = randomUUID(), orderId = randomUUID(), customerId = randomUUID()
const caps = { kds: true, waiterOrdering: true, guestOrdering: true, dineIn: true, tips: true, itemNotes: true, ingredientCustomization: true }
const result = <T>(data: T) => ({ data, error: null })
const repository = {
  tenantSettings: vi.fn(), checkoutFields: vi.fn(), capabilities: vi.fn(), stripeEnabled: vi.fn(), products: vi.fn(), optionGroups: vi.fn(), ingredients: vi.fn(),
  deliveryZones: vi.fn(), create: vi.fn(), recordAnalytics: vi.fn(), taxPromo: vi.fn(), recordTaxPromo: vi.fn(), scheduling: vi.fn(), recordScheduledFor: vi.fn(),
  loyaltyState: vi.fn(), recordLoyaltyRedeem: vi.fn(),
}
const order = (extra: Record<string, unknown> = {}) => ({
  tenant_id: tenantId, customer_name: 'Guest', customer_phone: '5550100200', tip_cents: 100,
  items: [{ product_id: productId, quantity: 2 }], ...extra,
})
const post = (body: unknown) => POSTRoute(new Request('http://localhost/api/orders', {
  method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'checkout-key-12345' },
}), undefined)
const signedIn = () => mocks.cookie.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: customerId, phone: '15550100200' } } }) } })

describe('POST /api/orders with a loyalty reward', () => {
  beforeEach(() => {
    vi.stubEnv('OWNED_ORDER_DATA_ENABLED', 'true')
    mocks.rate.mockResolvedValue({ ok: true }); mocks.effective.mockResolvedValue(null)
    signedIn()
    mocks.transaction.mockImplementation(async (_t: string, _w: boolean, operation: (repo: unknown) => unknown) => operation(repository))
    repository.checkoutFields.mockResolvedValue({ name: 'required', email: 'optional' })
    repository.tenantSettings.mockResolvedValue(result({ id: tenantId, is_active: true, tenant_settings: { orders_enabled: true, currency: 'USD', country: 'US' } }))
    repository.capabilities.mockResolvedValue(caps); repository.stripeEnabled.mockResolvedValue(false)
    // 2 x $10.00 = $20.00 subtotal.
    repository.products.mockResolvedValue(result([{ id: productId, tenant_id: tenantId, name: 'Dish', price: 10, is_available: true, menu_id: menuId,
      menus: { id: menuId, is_active: true, is_private: false, price_multiplier: 1 } }]))
    repository.optionGroups.mockResolvedValue(result([])); repository.ingredients.mockResolvedValue(result([]))
    repository.create.mockResolvedValue(result({ id: orderId, status: 'pending', total: 0, order_type: 'dine_in', replayed: false }))
    repository.taxPromo.mockResolvedValue({ ready: true, taxBps: 1000, promo: null })
    repository.scheduling.mockResolvedValue({ ready: false, enabled: false, hours: null, timeZone: null, prepMinutes: 0, maxNoticeMinutes: 0 })
    repository.loyaltyState.mockResolvedValue(state())
  })
  afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks() })

  it('takes the reward off the items, taxes the rest and spends the points in the same transaction', async () => {
    const response = await post(order({ use_loyalty_reward: true }))
    expect(response.status).toBe(200)
    // $20.00 - $10.00 reward = $10.00 taxed 10% = $1.00; tip $1.00 -> $12.00.
    expect(repository.create.mock.calls[0][0].total).toBe(12)
    expect(repository.loyaltyState).toHaveBeenCalledWith(customerId)
    expect(repository.recordTaxPromo).toHaveBeenCalledWith(orderId, { discountCents: 1000, taxCents: 100, promoCode: null })
    expect(repository.recordLoyaltyRedeem).toHaveBeenCalledWith(orderId, customerId, 20)
  })
  it('caps the discount at the items subtotal', async () => {
    repository.loyaltyState.mockResolvedValue(state({ rewardCents: 5000 }))
    const response = await post(order({ use_loyalty_reward: true }))
    expect(response.status).toBe(200)
    expect(repository.recordTaxPromo).toHaveBeenCalledWith(orderId, { discountCents: 2000, taxCents: 0, promoCode: null })
    expect(repository.create.mock.calls[0][0].total).toBe(1) // only the tip is left
  })
  it('refuses a guest (not signed in) and creates nothing', async () => {
    mocks.cookie.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) } })
    const response = await post(order({ use_loyalty_reward: true }))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'loyalty_sign_in' })
    expect(repository.create).not.toHaveBeenCalled()
  })
  it('cannot be combined with a promo code', async () => {
    repository.taxPromo.mockResolvedValue({ ready: true, taxBps: 1000, promo: { id: randomUUID(), code: 'WELCOME10', kind: 'percent', value: 10, starts_at: null, ends_at: null, is_active: true } })
    const response = await post(order({ use_loyalty_reward: true, promo_code: 'WELCOME10' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'loyalty_with_promo' })
    expect(repository.create).not.toHaveBeenCalled()
  })
  it('answers 409 when the balance is short', async () => {
    repository.loyaltyState.mockResolvedValue(state({ balance: 19 }))
    const response = await post(order({ use_loyalty_reward: true }))
    expect(response.status).toBe(409)
    expect(repository.create).not.toHaveBeenCalled()
  })
  it('rolls the order back when the locked re-check finds the points already spent', async () => {
    repository.recordLoyaltyRedeem.mockRejectedValue(new OrderDataError(409, 'Not enough loyalty points'))
    const response = await post(order({ use_loyalty_reward: true }))
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: 'Not enough loyalty points' })
  })
  it('is refused while the schema step has not run, and orders without a reward are untouched', async () => {
    repository.loyaltyState.mockResolvedValue(LOYALTY_NOT_READY)
    const refused = await post(order({ use_loyalty_reward: true }))
    expect(refused.status).toBe(400)
    expect(await refused.json()).toMatchObject({ code: 'loyalty_unavailable' })
    repository.create.mockClear()
    const plain = await post(order())
    expect(plain.status).toBe(200)
    expect(repository.create.mock.calls[0][0].total).toBe(23) // 2000 + 200 tax + 100 tip
    expect(repository.recordLoyaltyRedeem).not.toHaveBeenCalled()
  })
  it('does not offer rewards when the restaurant does not take guest orders', async () => {
    repository.capabilities.mockResolvedValue({ ...caps, guestOrdering: false })
    const response = await post(order({ use_loyalty_reward: true }))
    expect(response.status).toBe(403)
    expect(repository.loyaltyState).not.toHaveBeenCalled()
  })
})
