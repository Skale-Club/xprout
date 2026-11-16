/**
 * Simple loyalty: signed-in customers earn points when an order is completed and
 * can spend them on ONE reward (a fixed discount) at checkout. No tiers, no
 * expiry. Pure integer rules shared by POST /api/orders, the order status hooks,
 * the customer panel and the checkout display.
 *
 * Schema: docs/owned-schema/20261116170000_loyalty.sql. Until it is applied
 * `ready` is false and every order behaves as before. Loyalty runs on the owned
 * database only (the legacy Supabase path always reports "not ready").
 */

export const LOYALTY_CENTS_PER_POINT_MIN = 100
export const LOYALTY_CENTS_PER_POINT_MAX = 100_000
export const LOYALTY_REWARD_POINTS_MAX = 100_000
export const LOYALTY_REWARD_CENTS_MAX = 1_000_000

export type LoyaltyKind = 'earn' | 'redeem' | 'reverse' | 'refund'

export interface LoyaltySettings {
  enabled: boolean
  centsPerPoint: number
  rewardPoints: number
  rewardCents: number
}

/** What the database says about this restaurant's loyalty program and (when signed in) the customer's balance. */
export interface LoyaltyState extends LoyaltySettings {
  /** The schema step has run (columns and ledger exist). */
  ready: boolean
  /** Customer's balance in points; 0 for guests. */
  balance: number
}

export const LOYALTY_NOT_READY: LoyaltyState = { ready: false, enabled: false, centsPerPoint: 500, rewardPoints: 20, rewardCents: 1000, balance: 0 }

/** The columns and table that exist only after the schema step (owned database). */
export const LOYALTY_READY_SQL = `SELECT count(*) = 7 AS ready FROM information_schema.columns
  WHERE table_schema='public' AND (
    (table_name='tenant_settings' AND column_name IN ('loyalty_enabled','loyalty_cents_per_point','loyalty_reward_points','loyalty_reward_cents'))
    OR (table_name='orders' AND column_name IN ('loyalty_points_redeemed','discount_cents'))
    OR (table_name='loyalty_ledger' AND column_name='kind'))`

const int = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max

/** Valid program numbers (same bounds as the schema CHECK). */
export function loyaltySettingsValid(s: { centsPerPoint: unknown; rewardPoints: unknown; rewardCents: unknown }): boolean {
  return int(s.centsPerPoint, LOYALTY_CENTS_PER_POINT_MIN, LOYALTY_CENTS_PER_POINT_MAX)
    && int(s.rewardPoints, 1, LOYALTY_REWARD_POINTS_MAX)
    && int(s.rewardCents, 1, LOYALTY_REWARD_CENTS_MAX)
}

/** Points earned by an order: floor((items subtotal - discounts) / cents per point), integer math only. */
export function pointsEarned(subtotalCents: number, discountCents: number, centsPerPoint: number): number {
  if (!Number.isSafeInteger(subtotalCents) || !Number.isSafeInteger(discountCents) || !Number.isInteger(centsPerPoint) || centsPerPoint < 1) return 0
  const net = subtotalCents - discountCents
  return net > 0 ? Math.floor(net / centsPerPoint) : 0
}

/** The reward can be used: program on, a signed-in customer, enough points. */
export function canRedeem(state: LoyaltyState, signedIn: boolean): boolean {
  return state.ready && state.enabled && signedIn && state.balance >= state.rewardPoints
}

/** The reward's discount on an order: never more than the items subtotal, never negative. */
export function rewardDiscountCents(subtotalCents: number, rewardCents: number): number {
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents <= 0 || !Number.isInteger(rewardCents) || rewardCents <= 0) return 0
  return Math.min(subtotalCents, rewardCents)
}

export type RedeemRejection = 'unavailable' | 'sign_in' | 'with_promo' | 'insufficient'

/** Why a reward request cannot be honoured, or null when it can. One discount per order. */
export function redeemRejection(input: { state: LoyaltyState; signedIn: boolean; promoTyped: boolean }): RedeemRejection | null {
  if (!input.state.ready || !input.state.enabled) return 'unavailable'
  if (!input.signedIn) return 'sign_in'
  if (input.promoTyped) return 'with_promo'
  if (input.state.balance < input.state.rewardPoints) return 'insufficient'
  return null
}

export const REDEEM_MESSAGES: Record<RedeemRejection, { status: number; error: string }> = {
  unavailable: { status: 400, error: 'Loyalty rewards are not available for this restaurant' },
  sign_in: { status: 400, error: 'Sign in to use a loyalty reward' },
  with_promo: { status: 400, error: 'A loyalty reward cannot be combined with a promo code' },
  insufficient: { status: 409, error: 'Not enough loyalty points' },
}

/** A signed-in customer's progress toward the reward, e.g. 12 of 20 (full bar and `ready` once it can be used). */
export function rewardProgress(balance: number, rewardPoints: number): { current: number; target: number; ready: boolean } {
  const target = Math.max(1, rewardPoints)
  const safe = Math.max(0, Math.trunc(balance))
  return { current: Math.min(safe, target), target, ready: safe >= target }
}

/** "5" or "12.50" (dollars, 2 decimals at most) to cents; null when it is not an amount. */
export function amountToCents(input: string): number | null {
  const text = input.trim().replace(',', '.')
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text)) return null
  const [whole, fraction = ''] = text.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

/** Cents as the amount a person types: 500 -> "5", 1250 -> "12.50". */
export function centsToAmount(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2)
}
