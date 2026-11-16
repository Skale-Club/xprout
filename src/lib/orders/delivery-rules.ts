/**
 * Own-delivery rules: "deliver only inside my zones" and a minimum order per zone.
 * Pure integer-cent rules shared by POST /api/orders (the only place they are
 * enforced) and the checkout display. The minimum is checked against the items
 * subtotal BEFORE any promo discount (what most delivery platforms show).
 *
 * Schema: docs/owned-schema/20261116160000_delivery_rules_option_images.sql. Until
 * it is applied `ready` is false and delivery behaves as before.
 */

/** Upper bound of a zone minimum (cents); also a CHECK constraint in the schema. */
export const MIN_ORDER_CENTS_MAX = 1_000_000

export interface DeliveryRulesState {
  /** The schema step has run (both columns exist). */
  ready: boolean
  /** Active zones exist and an address outside all of them cannot order delivery. */
  zonesOnly: boolean
  /** Minimum items subtotal (cents) per zone id; absent or 0 = none. */
  minByZone: Record<string, number>
}

export const DELIVERY_RULES_NOT_READY: DeliveryRulesState = { ready: false, zonesOnly: false, minByZone: {} }

/** The columns that exist only after the schema step (owned database). */
export const DELIVERY_RULES_READY_SQL = `SELECT count(*) = 2 AS ready FROM information_schema.columns
  WHERE table_schema='public' AND (
    (table_name='tenant_settings' AND column_name='delivery_zones_only')
    OR (table_name='delivery_zones' AND column_name='min_order_cents'))`

/** A valid zone minimum in cents (0 = none), or null. */
export function parseMinOrderCents(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MIN_ORDER_CENTS_MAX ? value : null
}

export type DeliveryRuleViolation =
  | { code: 'zone_not_served'; error: string }
  | { code: 'minimum_not_met'; error: string; minOrderCents: number }

/**
 * Why a delivery order cannot be placed, or null. `zonesCount` is the number of
 * active zones, `matchedZoneId` the zone the address fell into (null = none).
 */
export function deliveryRuleViolation(input: {
  rules: DeliveryRulesState
  zonesCount: number
  matchedZoneId: string | null
  subtotalCents: number
}): DeliveryRuleViolation | null {
  const { rules, zonesCount, matchedZoneId, subtotalCents } = input
  if (!rules.ready) return null
  if (!matchedZoneId) {
    return rules.zonesOnly && zonesCount > 0
      ? { code: 'zone_not_served', error: "We don't deliver to this ZIP code yet" }
      : null
  }
  const min = rules.minByZone[matchedZoneId] ?? 0
  if (min > 0 && subtotalCents < min) {
    return { code: 'minimum_not_met', minOrderCents: min, error: `The minimum order for delivery to this area is ${(min / 100).toFixed(2)}` }
  }
  return null
}
