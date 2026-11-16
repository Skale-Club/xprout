import { describe, expect, it } from 'vitest'
import {
  DELIVERY_RULES_NOT_READY, MIN_ORDER_CENTS_MAX, deliveryRuleViolation, parseMinOrderCents, type DeliveryRulesState,
} from '@/lib/orders/delivery-rules'
import { legacyDeliveryRules } from '@/lib/orders/delivery-rules-legacy'
import { OwnedOrderRepository, type OrderQuery } from '@/lib/data/orders'

const rules = (extra: Partial<DeliveryRulesState> = {}): DeliveryRulesState => ({ ready: true, zonesOnly: false, minByZone: {}, ...extra })
const ZONE = 'zone-1'

describe('deliveryRuleViolation', () => {
  it('rejects an address outside every zone when zones-only is on', () => {
    const v = deliveryRuleViolation({ rules: rules({ zonesOnly: true }), zonesCount: 2, matchedZoneId: null, subtotalCents: 5000 })
    expect(v?.code).toBe('zone_not_served')
  })

  it('keeps the flat fee for an unmatched address when the switch is off', () => {
    expect(deliveryRuleViolation({ rules: rules(), zonesCount: 2, matchedZoneId: null, subtotalCents: 5000 })).toBeNull()
  })

  it('does not block when the restaurant has no active zones, even with the switch on', () => {
    expect(deliveryRuleViolation({ rules: rules({ zonesOnly: true }), zonesCount: 0, matchedZoneId: null, subtotalCents: 5000 })).toBeNull()
  })

  it('rejects a subtotal below the zone minimum and accepts it once reached', () => {
    const r = rules({ minByZone: { [ZONE]: 2500 } })
    const below = deliveryRuleViolation({ rules: r, zonesCount: 1, matchedZoneId: ZONE, subtotalCents: 2499 })
    expect(below).toMatchObject({ code: 'minimum_not_met', minOrderCents: 2500 })
    expect(deliveryRuleViolation({ rules: r, zonesCount: 1, matchedZoneId: ZONE, subtotalCents: 2500 })).toBeNull()
  })

  it('treats a missing or zero minimum as none, whatever the switch says', () => {
    expect(deliveryRuleViolation({ rules: rules({ zonesOnly: true, minByZone: { [ZONE]: 0 } }), zonesCount: 1, matchedZoneId: ZONE, subtotalCents: 1 })).toBeNull()
    expect(deliveryRuleViolation({ rules: rules(), zonesCount: 1, matchedZoneId: ZONE, subtotalCents: 1 })).toBeNull()
  })

  it('changes nothing until the schema step ran', () => {
    expect(deliveryRuleViolation({ rules: DELIVERY_RULES_NOT_READY, zonesCount: 3, matchedZoneId: null, subtotalCents: 1 })).toBeNull()
    expect(deliveryRuleViolation({ rules: { ...DELIVERY_RULES_NOT_READY, minByZone: { [ZONE]: 9999 } }, zonesCount: 3, matchedZoneId: ZONE, subtotalCents: 1 })).toBeNull()
  })
})

describe('parseMinOrderCents', () => {
  it('accepts whole cents from 0 to 1,000,000 only', () => {
    expect(parseMinOrderCents(0)).toBe(0)
    expect(parseMinOrderCents(MIN_ORDER_CENTS_MAX)).toBe(MIN_ORDER_CENTS_MAX)
    for (const bad of [-1, MIN_ORDER_CENTS_MAX + 1, 1.5, '100', null, undefined, NaN]) expect(parseMinOrderCents(bad)).toBeNull()
  })
})

describe('fallback when the schema is not applied', () => {
  it('legacy reader returns not-ready when the columns cannot be selected', async () => {
    const failing = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'column does not exist' } }) }) }) }) }
    expect(await legacyDeliveryRules(failing as never, 't')).toEqual(DELIVERY_RULES_NOT_READY)
  })

  it('owned reader returns not-ready without touching the new columns', async () => {
    const seen: string[] = []
    const query: OrderQuery = async text => { seen.push(text); return { rows: [{ ready: false }] } }
    const orders = new OwnedOrderRepository(query, '11111111-1111-4111-8111-111111111111')
    expect(await orders.deliveryRules()).toEqual(DELIVERY_RULES_NOT_READY)
    expect(seen).toHaveLength(1)
  })

  it('owned reader maps the switch and the minimums once ready', async () => {
    const query: OrderQuery = async text => {
      if (text.includes('information_schema')) return { rows: [{ ready: true }] }
      if (text.includes('tenant_settings')) return { rows: [{ row: { delivery_zones_only: true } }] }
      return { rows: [{ row: { id: 'z1', min_order_cents: 1500 } }, { row: { id: 'z2', min_order_cents: 0 } }] }
    }
    const orders = new OwnedOrderRepository(query, '11111111-1111-4111-8111-111111111111')
    expect(await orders.deliveryRules()).toEqual({ ready: true, zonesOnly: true, minByZone: { z1: 1500, z2: 0 } })
  })
})
