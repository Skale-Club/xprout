import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SCHEDULING_NOT_READY, asapBlockedReason, earliestSlotMs, generateSlots, groupSlotsByDay, localDayKey, noticeParts,
  requiredNoticeMinutes, resolveScheduledFor, type SchedulingState,
} from '@/lib/orders/scheduled-orders'
import { resolveTenantCapabilities } from '@/lib/service-modes'

// Monday 2026-11-16 15:07 in New York (EST, UTC-5, DST ended on Nov 1).
const NOW = new Date('2026-11-16T20:07:00Z')
const ZONE = 'America/New_York'
const HOURS = {
  mon: '11:00 - 22:00', tue: 'Closed', wed: '11:00 - 22:00', thu: '11:00 - 22:00',
  fri: '18:00 - 02:00', sat: '11:00 - 22:00', sun: '11:00 - 22:00',
}
const base = { hours: HOURS, timeZone: ZONE, prepMinutes: 20, maxNoticeMinutes: 0 }
const state = (extra: Partial<SchedulingState> = {}): SchedulingState => ({ ready: true, enabled: true, ...base, ...extra })
const localTime = (ms: number) => new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms))

describe('slots', () => {
  it('rounds now + prep time up to the next 15 minutes', () => {
    expect(earliestSlotMs(NOW, 20)).toBe(Date.parse('2026-11-16T20:30:00Z'))
    expect(earliestSlotMs(new Date('2026-11-16T20:15:00Z'), 0)).toBe(Date.parse('2026-11-16T20:15:00Z'))
  })

  it('starts at the earliest slot and stays inside the opening hours', () => {
    const slots = generateSlots({ now: NOW, ...base })
    expect(localTime(slots[0])).toBe('15:30')
    expect(slots.every(ms => ms % 900_000 === 0)).toBe(true)
    const days = groupSlotsByDay(slots, ZONE)
    expect(days[0].day).toBe('2026-11-16')
    expect(localTime(days[0].slots.at(-1)!)).toBe('21:45') // 22:00 itself is closing time
    // Tuesday is closed: no slots that day; Wednesday opens at 11:00.
    expect(days.some(d => d.day === '2026-11-17')).toBe(false)
    expect(days[1].day).toBe('2026-11-18')
    expect(localTime(days[1].slots[0])).toBe('11:00')
    // Seven days ahead at most.
    expect(slots.at(-1)!).toBeLessThanOrEqual(NOW.getTime() + 7 * 86_400_000)
  })

  it('needs the longest notice in the cart when it exceeds the prep time', () => {
    expect(requiredNoticeMinutes(20, 180)).toBe(180)
    expect(requiredNoticeMinutes(20, 5)).toBe(20)
    const slots = generateSlots({ now: NOW, ...base, maxNoticeMinutes: 180 })
    expect(localTime(slots[0])).toBe('18:15') // 15:07 + 3 h = 18:07, rounded up
  })

  it('runs past midnight into the next local day (Friday 18:00 - 02:00)', () => {
    const slots = generateSlots({ now: NOW, ...base })
    const saturday = groupSlotsByDay(slots, ZONE).find(d => d.day === '2026-11-21')!
    expect(localTime(saturday.slots[0])).toBe('00:00')
    expect(saturday.slots.map(localTime)).toContain('01:45')
    expect(saturday.slots.map(localTime)).not.toContain('02:00')
    expect(saturday.slots.map(localTime)).not.toContain('09:00')
    expect(saturday.slots.map(localTime)).toContain('11:00')
    expect(localDayKey(Date.parse('2026-11-21T05:30:00Z'), ZONE)).toBe('2026-11-21') // 00:30 local, still Saturday
  })

  it('offers nothing without a time zone or readable hours', () => {
    expect(generateSlots({ now: NOW, ...base, timeZone: null })).toEqual([])
    expect(generateSlots({ now: NOW, ...base, hours: null })).toEqual([])
    expect(generateSlots({ now: NOW, ...base, hours: { mon: 'By appointment' } })).toEqual([])
  })
})

describe('ASAP', () => {
  it('is allowed when open and no dish needs more notice than the prep time', () => {
    expect(asapBlockedReason({ now: NOW, ...base })).toBeNull()
    expect(asapBlockedReason({ now: NOW, ...base, maxNoticeMinutes: 20 })).toBeNull()
  })
  it('is blocked by a dish whose notice exceeds the prep time', () => {
    expect(asapBlockedReason({ now: NOW, ...base, maxNoticeMinutes: 60 })).toBe('notice')
  })
  it('is blocked while the restaurant is closed, but unknown hours never block it', () => {
    expect(asapBlockedReason({ now: new Date('2026-11-17T20:00:00Z'), ...base })).toBe('closed') // Tuesday
    expect(asapBlockedReason({ now: NOW, ...base, hours: null })).toBeNull()
    expect(asapBlockedReason({ now: NOW, ...base, timeZone: null })).toBeNull()
  })
})

describe('resolveScheduledFor (the server decision)', () => {
  const decide = (scheduledFor: string | null | undefined, st: SchedulingState = state(), now = NOW, guestOrdering = true) =>
    resolveScheduledFor({ scheduledFor, now, state: st, guestOrdering })

  it('accepts a slot inside the hours and returns it as ISO', () => {
    expect(decide('2026-11-16T21:00:00Z')).toEqual({ scheduledFor: '2026-11-16T21:00:00.000Z' })
  })
  it('treats an order without a time as ASAP', () => {
    expect(decide(undefined)).toEqual({ scheduledFor: null })
    expect(decide(null)).toEqual({ scheduledFor: null })
  })
  it('rejects a time outside the opening hours', () => {
    expect(decide('2026-11-17T17:00:00Z')).toMatchObject({ status: 400, error: expect.stringContaining('closed') }) // Tuesday noon
    expect(decide('2026-11-17T04:00:00Z')).toMatchObject({ status: 400 }) // Monday 23:00 local
  })
  it('rejects a time that is too early for the prep time or the dishes', () => {
    expect(decide('2026-11-16T20:15:00Z')).toMatchObject({ status: 400, error: expect.stringContaining('too soon') })
    expect(decide('2026-11-16T21:00:00Z', state({ maxNoticeMinutes: 120 }))).toMatchObject({ status: 400, error: expect.stringContaining('too soon') })
    expect(decide('2026-11-16T22:15:00Z', state({ maxNoticeMinutes: 120 }))).toEqual({ scheduledFor: '2026-11-16T22:15:00.000Z' })
  })
  it('allows the 2-minute grace on the notice', () => {
    const st = state({ prepMinutes: 15 })
    expect(decide('2026-11-16T20:15:00Z', st, new Date('2026-11-16T20:01:00Z'))).toEqual({ scheduledFor: '2026-11-16T20:15:00.000Z' })
    expect(decide('2026-11-16T20:15:00Z', st, new Date('2026-11-16T20:03:00Z'))).toMatchObject({ status: 400 })
  })
  it('rejects more than 7 days ahead', () => {
    expect(decide('2026-11-23T20:30:00Z')).toMatchObject({ status: 400, error: expect.stringContaining('7 days') })
    expect(decide('2026-11-23T20:00:00Z')).toEqual({ scheduledFor: '2026-11-23T20:00:00.000Z' })
  })
  it('rejects a time off the 15-minute boundary or not a time at all', () => {
    expect(decide('2026-11-16T21:05:00Z')).toMatchObject({ status: 400, error: expect.stringContaining('15-minute') })
    expect(decide('2026-11-16T21:00:30Z')).toMatchObject({ status: 400 })
    expect(decide('tomorrow')).toMatchObject({ status: 400, error: expect.stringContaining('Invalid') })
  })
  it('rejects a missing time when a dish needs notice, or when the restaurant is closed now', () => {
    expect(decide(null, state({ maxNoticeMinutes: 120 }))).toMatchObject({ status: 400, error: expect.stringContaining('notice') })
    expect(decide(null, state(), new Date('2026-11-17T20:00:00Z'))).toMatchObject({ status: 400, error: expect.stringContaining('closed') })
  })
  it('refuses a time when scheduling is off, for staff, or the schema step has not run', () => {
    expect(decide('2026-11-16T21:00:00Z', state({ enabled: false }))).toMatchObject({ status: 400, error: expect.stringContaining('not enabled') })
    expect(decide('2026-11-16T21:00:00Z', state(), NOW, false)).toMatchObject({ status: 400 })
    expect(decide('2026-11-16T21:00:00Z', SCHEDULING_NOT_READY)).toMatchObject({ status: 400 })
  })
  it('changes nothing for an ordinary order when scheduling is off or not ready', () => {
    expect(decide(undefined, SCHEDULING_NOT_READY, new Date('2026-11-17T20:00:00Z'))).toEqual({ scheduledFor: null })
    expect(decide(undefined, state({ enabled: false, maxNoticeMinutes: 600 }))).toEqual({ scheduledFor: null })
  })
})

describe('capability and pill', () => {
  const features = ['orders', 'payments']
  const on = { orders_enabled: true, direct_orders_enabled: true, scheduled_orders_enabled: true }
  it('needs guest ordering and the restaurant switch', () => {
    expect(resolveTenantCapabilities(features, on).scheduledOrders).toBe(true)
    expect(resolveTenantCapabilities(features, { ...on, scheduled_orders_enabled: false }).scheduledOrders).toBe(false)
    expect(resolveTenantCapabilities(features, { ...on, direct_orders_enabled: false }).scheduledOrders).toBe(false)
    expect(resolveTenantCapabilities(['orders'], on).scheduledOrders).toBe(false)
  })
  it('words the notice in minutes, hours or days', () => {
    expect(noticeParts(30)).toEqual({ unit: 'min', value: 30 })
    expect(noticeParts(60)).toEqual({ unit: 'h', value: 1 })
    expect(noticeParts(90)).toEqual({ unit: 'h', value: 2 })
    expect(noticeParts(2880)).toEqual({ unit: 'd', value: 2 })
  })
})

// POST /api/orders: the route re-checks everything and writes the time after the order function.
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
  deliveryZones: vi.fn(), create: vi.fn(), recordAnalytics: vi.fn(), taxPromo: vi.fn(), recordTaxPromo: vi.fn(), scheduling: vi.fn(), recordScheduledFor: vi.fn(),
}
const order = (extra: Record<string, unknown> = {}) => ({
  tenant_id: tenantId, customer_name: 'Guest', customer_phone: '5550100200', items: [{ product_id: productId, quantity: 1 }], ...extra,
})
const post = (body: unknown, key = 'checkout-key-12345') => POSTRoute(new Request('http://localhost/api/orders', {
  method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
}), undefined)

describe('POST /api/orders with a scheduled time', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    vi.stubEnv('OWNED_ORDER_DATA_ENABLED', 'true')
    mocks.rate.mockResolvedValue({ ok: true }); mocks.effective.mockResolvedValue(null)
    mocks.cookie.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) } })
    mocks.transaction.mockImplementation(async (_t: string, _w: boolean, operation: (repo: unknown) => unknown) => operation(repository))
    repository.tenantSettings.mockResolvedValue(result({ id: tenantId, is_active: true, tenant_settings: { orders_enabled: true, currency: 'USD', country: 'US' } }))
    repository.capabilities.mockResolvedValue(caps); repository.stripeEnabled.mockResolvedValue(false)
    repository.products.mockResolvedValue(result([{ id: productId, tenant_id: tenantId, name: 'Dish', price: 10, is_available: true, menu_id: menuId,
      menus: { id: menuId, is_active: true, is_private: false, price_multiplier: 1 } }]))
    repository.optionGroups.mockResolvedValue(result([])); repository.ingredients.mockResolvedValue(result([]))
    repository.create.mockResolvedValue(result({ id: orderId, status: 'pending', total: 10, order_type: 'dine_in', replayed: false }))
    repository.taxPromo.mockResolvedValue({ ready: false, taxBps: 0, promo: null })
    repository.scheduling.mockResolvedValue(state())
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.resetAllMocks() })

  it('stores the time right after the order function, and puts it in the idempotency fingerprint', async () => {
    const response = await post(order({ scheduled_for: '2026-11-16T21:00:00Z' }))
    expect(response.status).toBe(200)
    expect(repository.scheduling).toHaveBeenCalledWith([productId])
    expect(repository.recordScheduledFor).toHaveBeenCalledWith(orderId, '2026-11-16T21:00:00.000Z')
    await post(order({ scheduled_for: '2026-11-16T21:15:00Z' }))
    await post(order())
    const [first, second, asap] = repository.create.mock.calls.map(call => call[0].request_fingerprint)
    expect(first).not.toBe(second)
    expect(first).not.toBe(asap)
    // The order row itself never carries the column (the order function is hash-pinned).
    expect(repository.create.mock.calls[0][0]).not.toHaveProperty('scheduled_for')
  })

  it.each([
    ['outside the opening hours', { scheduled_for: '2026-11-17T17:00:00Z' }, state()],
    ['too early for the prep time', { scheduled_for: '2026-11-16T20:15:00Z' }, state()],
    ['too early for a dish that needs notice', { scheduled_for: '2026-11-16T21:00:00Z' }, state({ maxNoticeMinutes: 180 })],
    ['more than 7 days ahead', { scheduled_for: '2026-11-23T20:30:00Z' }, state()],
    ['off the 15-minute boundary', { scheduled_for: '2026-11-16T21:05:00Z' }, state()],
    ['missing when a dish needs notice', {}, state({ maxNoticeMinutes: 180 })],
    ['sent while scheduling is off', { scheduled_for: '2026-11-16T21:00:00Z' }, state({ enabled: false })],
  ])('rejects a time %s with a 400 and creates nothing', async (_label, extra, st) => {
    repository.scheduling.mockResolvedValue(st)
    const response = await post(order(extra))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'schedule_invalid' })
    expect(repository.create).not.toHaveBeenCalled()
  })

  it('behaves exactly as before while the schema step has not run', async () => {
    repository.scheduling.mockResolvedValue(SCHEDULING_NOT_READY)
    const asap = await post(order())
    expect(asap.status).toBe(200)
    expect(repository.recordScheduledFor).not.toHaveBeenCalled()
    const scheduled = await post(order({ scheduled_for: '2026-11-16T21:00:00Z' }))
    expect(scheduled.status).toBe(400)
  })

  it('does not look at scheduling when the restaurant does not take guest orders', async () => {
    repository.capabilities.mockResolvedValue({ ...caps, guestOrdering: false })
    expect((await post(order())).status).toBe(403)
    expect(repository.scheduling).not.toHaveBeenCalled()
  })
})

describe('owned repository scheduling()', () => {
  it('reads nothing but the readiness check before the schema step ran', async () => {
    const { OwnedOrderRepository } = await import('@/lib/data/orders')
    const query = vi.fn(async () => ({ rows: [{ ready: false }] }))
    const repo = new OwnedOrderRepository(query, tenantId)
    expect(await repo.scheduling([productId])).toEqual(SCHEDULING_NOT_READY)
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('returns the switch, hours, zone, prep time and the longest notice once it ran', async () => {
    const { OwnedOrderRepository } = await import('@/lib/data/orders')
    const query = vi.fn(async (text: string) => {
      if (text.includes('information_schema.columns')) return { rows: [{ ready: true }] }
      if (text.includes('max(min_notice_minutes)')) return { rows: [{ notice: 90 }] }
      return { rows: [{ row: { scheduled_orders_enabled: true, business_hours: HOURS, country: 'US', region: 'NY', currency: 'USD', pickup_eta_minutes: 25 } }] }
    })
    const repo = new OwnedOrderRepository(query, tenantId)
    expect(await repo.scheduling([productId])).toEqual({ ready: true, enabled: true, hours: HOURS, timeZone: ZONE, prepMinutes: 25, maxNoticeMinutes: 90 })
  })
})
