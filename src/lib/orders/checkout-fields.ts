/**
 * What guest checkout asks besides the phone (always required): each restaurant
 * sets the name and the receipt email to 'required', 'optional' or 'hidden'
 * (Settings › Store › Customer details). The columns arrive with one schema step
 * (docs/owned-schema/20261118120000_checkout_customer_fields.sql) that may run
 * after the code deploys; until then every reader uses the defaults, which are
 * the checkout as it was: name required, email optional.
 */

export const CHECKOUT_FIELD_MODES = ['required', 'optional', 'hidden'] as const
export type CheckoutFieldMode = (typeof CHECKOUT_FIELD_MODES)[number]
export type CheckoutFields = { name: CheckoutFieldMode; email: CheckoutFieldMode }

export const DEFAULT_CHECKOUT_FIELDS: CheckoutFields = { name: 'required', email: 'optional' }
export const CHECKOUT_FIELD_COLUMNS = ['checkout_name_mode', 'checkout_email_mode'] as const

/** Owned database: whether the schema step ran. */
export const CHECKOUT_FIELDS_READY_SQL = `SELECT count(*) = 2 AS ready FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tenant_settings' AND column_name IN ('checkout_name_mode','checkout_email_mode')`

/** Owned database: the restaurant's two modes as one { row } (run only once ready). */
export const CHECKOUT_FIELDS_SQL = `SELECT jsonb_build_object('checkout_name_mode', s.checkout_name_mode, 'checkout_email_mode', s.checkout_email_mode) AS row
  FROM public.tenant_settings s WHERE s.tenant_id=$1 LIMIT 2`

/** A plausible email: the same rule checkout and the receipt use. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const isPlausibleEmail = (value: string | null | undefined) => EMAIL_PATTERN.test((value ?? '').trim())

export const isCheckoutFieldMode = (value: unknown): value is CheckoutFieldMode =>
  typeof value === 'string' && (CHECKOUT_FIELD_MODES as readonly string[]).includes(value)

/** The modes from a settings row; a missing or unknown value is the default. */
export function checkoutFieldsFrom(settings: { checkout_name_mode?: unknown; checkout_email_mode?: unknown } | null | undefined): CheckoutFields {
  return {
    name: isCheckoutFieldMode(settings?.checkout_name_mode) ? settings.checkout_name_mode : DEFAULT_CHECKOUT_FIELDS.name,
    email: isCheckoutFieldMode(settings?.checkout_email_mode) ? settings.checkout_email_mode : DEFAULT_CHECKOUT_FIELDS.email,
  }
}

export type CheckoutFieldViolation = { error: string; code: 'name_required' | 'email_required' }

/** Server and client: what a guest order is missing for this restaurant (the phone is checked by the schema). */
export function checkoutFieldViolation(fields: CheckoutFields, input: { name?: string | null; email?: string | null }): CheckoutFieldViolation | null {
  if (fields.name === 'required' && !(input.name ?? '').trim()) return { error: 'Customer name is required', code: 'name_required' }
  if (fields.email === 'required' && !isPlausibleEmail(input.email)) return { error: 'A valid email for the receipt is required', code: 'email_required' }
  return null
}

/**
 * The name to show staff for an order. Guests may order without a name where the
 * restaurant allows it, so an empty name falls back to "Guest" and the last four
 * digits of the phone (enough to call the order out at the counter).
 */
export function customerDisplayName(name: string | null | undefined, phone?: string | null): string {
  const trimmed = (name ?? '').trim()
  if (trimmed) return trimmed
  const digits = (phone ?? '').replace(/\D/g, '')
  return digits.length >= 4 ? `Guest · ${digits.slice(-4)}` : 'Guest'
}
