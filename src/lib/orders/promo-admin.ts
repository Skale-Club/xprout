/** Validation of a promo code a restaurant creates (Settings > Promo codes); pure, shared by the owned and legacy paths. */
import { normalizePromoCode, type PromoKind } from './tax-promo'

export interface PromoCodeInput {
  code: string
  kind: PromoKind
  value: number
  starts_at: string | null
  ends_at: string | null
}

export type PromoInputResult = { ok: true; value: PromoCodeInput } | { ok: false; error: string }

function optionalDate(input: unknown): string | null | undefined {
  if (input === null || input === undefined || input === '') return null
  if (typeof input !== 'string' || !Number.isFinite(Date.parse(input))) return undefined
  return new Date(input).toISOString()
}

/** `value` is a whole percent (1-100) or an amount in cents; the dates are optional ISO strings. */
export function parsePromoInput(body: unknown): PromoInputResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Invalid promo code' }
  const input = body as Record<string, unknown>
  const code = normalizePromoCode(input.code)
  if (!code) return { ok: false, error: 'The code must be 2 to 32 letters, numbers, "-" or "_"' }
  if (input.kind !== 'percent' && input.kind !== 'fixed') return { ok: false, error: 'Choose percent or fixed amount' }
  const value = input.value
  if (typeof value !== 'number' || !Number.isInteger(value)) return { ok: false, error: 'Invalid discount value' }
  if (input.kind === 'percent' && (value < 1 || value > 100)) return { ok: false, error: 'A percent discount must be between 1 and 100' }
  if (input.kind === 'fixed' && (value < 1 || value > 10_000_000)) return { ok: false, error: 'Invalid discount amount' }
  const starts = optionalDate(input.starts_at)
  const ends = optionalDate(input.ends_at)
  if (starts === undefined || ends === undefined) return { ok: false, error: 'Invalid date' }
  if (starts && ends && Date.parse(ends) <= Date.parse(starts)) return { ok: false, error: 'The end date must be after the start date' }
  return { ok: true, value: { code, kind: input.kind, value, starts_at: starts, ends_at: ends } }
}
