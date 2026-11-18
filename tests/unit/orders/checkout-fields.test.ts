import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CHECKOUT_FIELDS,
  checkoutFieldViolation,
  checkoutFieldsFrom,
  customerDisplayName,
  isCheckoutFieldMode,
} from '@/lib/orders/checkout-fields'
import { createOrderSchema } from '@/lib/orders/order-input'

describe('checkout customer fields', () => {
  it('defaults to the checkout as it was: name required, email optional', () => {
    expect(DEFAULT_CHECKOUT_FIELDS).toEqual({ name: 'required', email: 'optional' })
    expect(checkoutFieldsFrom(null)).toEqual(DEFAULT_CHECKOUT_FIELDS)
    expect(checkoutFieldsFrom({})).toEqual(DEFAULT_CHECKOUT_FIELDS)
    expect(checkoutFieldsFrom({ checkout_name_mode: 'nope', checkout_email_mode: 7 })).toEqual(DEFAULT_CHECKOUT_FIELDS)
  })

  it('reads the restaurant modes', () => {
    expect(checkoutFieldsFrom({ checkout_name_mode: 'hidden', checkout_email_mode: 'required' })).toEqual({ name: 'hidden', email: 'required' })
    expect(isCheckoutFieldMode('optional')).toBe(true)
    expect(isCheckoutFieldMode('Optional')).toBe(false)
  })

  it('requires the name only when the restaurant does', () => {
    expect(checkoutFieldViolation({ name: 'required', email: 'optional' }, { name: '  ' })?.code).toBe('name_required')
    expect(checkoutFieldViolation({ name: 'required', email: 'optional' }, { name: 'Ana' })).toBeNull()
    expect(checkoutFieldViolation({ name: 'optional', email: 'optional' }, { name: '' })).toBeNull()
    expect(checkoutFieldViolation({ name: 'hidden', email: 'optional' }, { name: '' })).toBeNull()
  })

  it('requires a plausible email only when the restaurant does', () => {
    const fields = { name: 'optional', email: 'required' } as const
    expect(checkoutFieldViolation(fields, { email: null })?.code).toBe('email_required')
    expect(checkoutFieldViolation(fields, { email: 'ana@' })?.code).toBe('email_required')
    expect(checkoutFieldViolation(fields, { email: 'ana@example.com' })).toBeNull()
    expect(checkoutFieldViolation({ name: 'optional', email: 'optional' }, { email: '' })).toBeNull()
  })

  it('names a nameless order "Guest" with the last phone digits', () => {
    expect(customerDisplayName('  Ana ', '+1 555 0100')).toBe('Ana')
    expect(customerDisplayName('', '+1 (201) 555-0123')).toBe('Guest · 0123')
    expect(customerDisplayName(null, '12')).toBe('Guest')
  })

  it('accepts an order without a name at the schema level (the route decides)', () => {
    const base = { tenant_id: '00000000-0000-4000-8000-000000000001', customer_phone: '2015550123', items: [{ product_id: '00000000-0000-4000-8000-000000000002', quantity: 1 }] }
    const parsed = createOrderSchema.safeParse(base)
    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.customer_name).toBe('')
    expect(createOrderSchema.safeParse({ ...base, customer_phone: ' ' }).success).toBe(false)
  })
})
