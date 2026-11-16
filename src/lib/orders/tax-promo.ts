/**
 * Sales tax and promo codes for guest checkout. Pure integer-cent rules shared
 * by POST /api/orders (the only place a total is decided), the public preview
 * endpoint and the checkout display. Tips and delivery are never taxed; a code
 * only reduces the items subtotal; at most one code per order.
 *
 * Schema: docs/owned-schema/20261116130000_tax_and_promo_codes.sql. Until it is
 * applied `ready` is false and every order behaves as before.
 */

/** 25% in basis points; also a CHECK constraint in the schema. */
export const TAX_RATE_BPS_MAX = 2500

export type PromoKind = 'percent' | 'fixed'

export interface PromoCodeRow {
  id: string
  code: string
  kind: PromoKind
  value: number
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
}

/** What the database says about this restaurant's tax and the code a guest typed. */
export interface TaxPromoState {
  /** The schema step has run (columns and table exist). */
  ready: boolean
  taxBps: number
  /** The row matching the typed code for this tenant, or null when none does. */
  promo: PromoCodeRow | null
}

export const TAX_PROMO_NOT_READY: TaxPromoState = { ready: false, taxBps: 0, promo: null }

/** The tables and columns that exist only after the schema step (owned database). */
export const TAX_PROMO_READY_SQL = `SELECT count(*) = 5 AS ready FROM information_schema.columns
  WHERE table_schema='public' AND (
    (table_name='tenant_settings' AND column_name='tax_rate_bps')
    OR (table_name='orders' AND column_name IN ('discount_cents','tax_cents','promo_code'))
    OR (table_name='promo_codes' AND column_name='code'))`

/** Upper-case code of 2-32 letters, digits, "_" or "-"; null when it cannot be a code. */
export function normalizePromoCode(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const code = input.trim().toUpperCase()
  return /^[A-Z0-9_-]{2,32}$/.test(code) ? code : null
}

/** Tax on (subtotal - discount), round-half-up, integer math only. */
export function taxCents(taxableCents: number, rateBps: number): number {
  if (!Number.isSafeInteger(taxableCents) || taxableCents <= 0 || !Number.isInteger(rateBps) || rateBps <= 0) return 0
  return Math.floor((taxableCents * rateBps + 5000) / 10000)
}

/** Why a code cannot be used right now, or null when it can. */
export function promoRejection(promo: PromoCodeRow | null, now: Date): 'invalid' | null {
  if (!promo || !promo.is_active) return 'invalid'
  if (promo.starts_at && Date.parse(promo.starts_at) > now.getTime()) return 'invalid'
  if (promo.ends_at && Date.parse(promo.ends_at) <= now.getTime()) return 'invalid'
  if (promo.kind === 'percent') return Number.isInteger(promo.value) && promo.value >= 1 && promo.value <= 100 ? null : 'invalid'
  if (promo.kind === 'fixed') return Number.isInteger(promo.value) && promo.value >= 1 ? null : 'invalid'
  return 'invalid'
}

/** The discount on the items subtotal: never more than the subtotal, never negative. */
export function discountCents(subtotalCents: number, promo: Pick<PromoCodeRow, 'kind' | 'value'>): number {
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents <= 0) return 0
  const raw = promo.kind === 'percent' ? Math.floor((subtotalCents * promo.value + 50) / 100) : promo.value
  return Math.max(0, Math.min(subtotalCents, raw))
}

export interface PricedOrder {
  discountCents: number
  taxCents: number
  totalCents: number
}

/** total = subtotal - discount + tax + delivery + tip. */
export function priceOrder(input: {
  subtotalCents: number
  promo: PromoCodeRow | null
  taxBps: number
  deliveryFeeCents: number
  tipCents: number
}): PricedOrder {
  const discount = input.promo ? discountCents(input.subtotalCents, input.promo) : 0
  const tax = taxCents(input.subtotalCents - discount, input.taxBps)
  return {
    discountCents: discount,
    taxCents: tax,
    totalCents: input.subtotalCents - discount + tax + input.deliveryFeeCents + input.tipCents,
  }
}

/** "6.25" or "6,25" (percent) to basis points; null when not a number from 0 to 25 with at most 2 decimals. */
export function percentToBps(input: string): number | null {
  const text = input.trim().replace(',', '.')
  if (text === '') return 0
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(text)) return null
  const bps = Math.round(Number(text) * 100)
  return bps >= 0 && bps <= TAX_RATE_BPS_MAX ? bps : null
}

/** Basis points as the percent a person types: 625 -> "6.25", 800 -> "8". */
export function bpsToPercent(bps: number): string {
  return String(Number((bps / 100).toFixed(2)))
}
