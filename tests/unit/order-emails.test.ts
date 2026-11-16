import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeEmail } from '@/lib/orders/order-contact'
import { createOrderSchema } from '@/lib/orders/order-input'
import {
  orderEmailMode, renderOrderEmail, resetOrderEmailLogForTests, sendOrderEmail,
  type OrderEmailData, type OrderEmailKind, type OrderEmailStore,
} from '@/lib/orders/order-emails'
import { buildEmailData } from '@/lib/orders/order-email-data'

const ORDER_ID = 'a1b2c3d4-0000-4000-8000-000000000001'
const PROD = { NODE_ENV: 'production', RESEND_API_KEY: 're_test', ORDER_EMAIL_FROM: 'orders@xprout.app' }
const NAME = `Joe's "Diner"`

const data = (extra: Partial<OrderEmailData> = {}): OrderEmailData => ({
  orderId: ORDER_ID, email: 'guest@example.com', lang: null, orderType: 'pickup', scheduledFor: null, timeZone: 'America/New_York', etaMinutes: 20,
  currency: 'USD', subtotal: 30, discountCents: 300, promoCode: 'SAVE10', taxCents: 216, deliveryFeeCents: 500, tipCents: 400, total: 36.16,
  items: [
    { name: 'Burger <b>', quantity: 2, unitPrice: 12, details: ['Size: Large', 'No Onion'], notes: 'Well done & hot' },
    { name: 'Fries', quantity: 1, unitPrice: 6, details: [], notes: null },
  ],
  deliveryAddress: '1 Main St', restaurant: { name: NAME, logoUrl: 'https://cdn.example.com/logo.png', primaryColor: '#cc0000', phone: '+1 555 0100', address: '1 Main St, Springfield' },
  ...extra,
})

/** An in-memory store with the same conditional-claim behaviour as the SQL one. */
function memoryStore(source: OrderEmailData | null = data()) {
  const sent = new Set<string>()
  const store: OrderEmailStore & { claims: number; released: number } = {
    claims: 0, released: 0,
    async claim(_id: string, kind: OrderEmailKind) {
      store.claims++
      if (!source || sent.has(kind)) return null
      sent.add(kind)
      return source
    },
    async release(_id: string, kind: OrderEmailKind) { store.released++; sent.delete(kind) },
  }
  return store
}

const okFetch = () => vi.fn<typeof fetch>(async () => new Response('{"id":"x"}', { status: 200 }))

beforeEach(() => resetOrderEmailLogForTests())
afterEach(() => vi.restoreAllMocks())

describe('email validation', () => {
  it('lower-cases and trims a plausible address', () => {
    expect(normalizeEmail('  Guest@Example.COM ')).toBe('guest@example.com')
  })
  it('rejects blanks, missing parts, spaces and anything over 254 characters', () => {
    for (const bad of ['', '  ', 'guest', 'guest@', '@example.com', 'a b@example.com', 'guest@example', `${'a'.repeat(250)}@x.com`, 42, null]) {
      expect(normalizeEmail(bad)).toBeNull()
    }
  })
  it('the order contract accepts an empty or valid email and rejects a bad one', () => {
    const base = { tenant_id: ORDER_ID, customer_name: 'A', customer_phone: '1', items: [{ product_id: ORDER_ID, quantity: 1 }] }
    expect(createOrderSchema.safeParse({ ...base, customer_email: '' }).success).toBe(true)
    expect(createOrderSchema.safeParse({ ...base, customer_email: 'a@b.co' }).success).toBe(true)
    expect(createOrderSchema.safeParse({ ...base }).success).toBe(true)
    expect(createOrderSchema.safeParse({ ...base, customer_email: 'nope' }).success).toBe(false)
    expect(createOrderSchema.safeParse({ ...base, customer_email: `${'a'.repeat(250)}@x.com` }).success).toBe(false)
  })
})

describe('when emails go out', () => {
  it('needs the key and the sender address', () => {
    expect(orderEmailMode({ ...PROD, RESEND_API_KEY: '' })).toMatchObject({ send: false })
    expect(orderEmailMode({ ...PROD, ORDER_EMAIL_FROM: undefined })).toMatchObject({ send: false })
    expect(orderEmailMode(PROD)).toEqual({ send: true })
  })
  it('is off outside production unless explicitly allowed', () => {
    expect(orderEmailMode({ ...PROD, NODE_ENV: 'development' })).toMatchObject({ send: false })
    expect(orderEmailMode({ ...PROD, NODE_ENV: 'development', ORDER_EMAILS_IN_DEVELOPMENT: 'true' })).toEqual({ send: true })
  })
  it('does not even claim the order without a key', async () => {
    const store = memoryStore(), fetchImpl = okFetch()
    expect(await sendOrderEmail(store, ORDER_ID, 'received', { env: { NODE_ENV: 'production' }, fetchImpl })).toBe(false)
    expect(store.claims).toBe(0)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('does not send in development', async () => {
    const store = memoryStore(), fetchImpl = okFetch()
    expect(await sendOrderEmail(store, ORDER_ID, 'ready', { env: { ...PROD, NODE_ENV: 'development' }, fetchImpl })).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('sending', () => {
  it('posts one Resend request with the restaurant name as the sender name', async () => {
    const store = memoryStore(), fetchImpl = okFetch()
    expect(await sendOrderEmail(store, ORDER_ID, 'received', { env: PROD, fetchImpl })).toBe(true)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test')
    const body = JSON.parse(String(init.body))
    expect(body.from).toBe(`Joe's Diner <orders@xprout.app>`)
    expect(body.to).toEqual(['guest@example.com'])
    expect(body.subject).toContain('A1B2C3D4')
  })
  it('is idempotent per order and kind: the second call is a no-op', async () => {
    const store = memoryStore(), fetchImpl = okFetch()
    expect(await sendOrderEmail(store, ORDER_ID, 'received', { env: PROD, fetchImpl })).toBe(true)
    expect(await sendOrderEmail(store, ORDER_ID, 'received', { env: PROD, fetchImpl })).toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(await sendOrderEmail(store, ORDER_ID, 'ready', { env: PROD, fetchImpl })).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
  it('sends nothing when the order has no email to claim', async () => {
    const fetchImpl = okFetch()
    expect(await sendOrderEmail(memoryStore(null), ORDER_ID, 'received', { env: PROD, fetchImpl })).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('never throws, and releases the claim when Resend fails so a retry can send', async () => {
    const store = memoryStore()
    const failing = vi.fn<typeof fetch>(async () => new Response('nope', { status: 500 }))
    expect(await sendOrderEmail(store, ORDER_ID, 'ready', { env: PROD, fetchImpl: failing })).toBe(false)
    expect(store.released).toBe(1)
    const throwing = vi.fn<typeof fetch>(async () => { throw new Error('network') })
    expect(await sendOrderEmail(store, ORDER_ID, 'ready', { env: PROD, fetchImpl: throwing })).toBe(false)
    expect(await sendOrderEmail(store, ORDER_ID, 'ready', { env: PROD, fetchImpl: okFetch() })).toBe(true)
  })
  it('does not throw when the store itself fails', async () => {
    const store: OrderEmailStore = { claim: async () => { throw new Error('db down') }, release: async () => {} }
    expect(await sendOrderEmail(store, ORDER_ID, 'received', { env: PROD, fetchImpl: okFetch() })).toBe(false)
  })
})

describe('rendering', () => {
  it('shows every total line from the stored snapshot', () => {
    const { html, text, subject } = renderOrderEmail('received', data())
    expect(subject).toBe(`Order received #A1B2C3D4 · ${NAME}`)
    for (const part of ['$30.00', '-$3.00', '$2.16', '$5.00', '$4.00', '$36.16']) {
      expect(html).toContain(part)
      expect(text).toContain(part)
    }
    expect(text).toContain('Discount (SAVE10)')
    expect(text).toContain('2x Burger <b>  $24.00')
    expect(text).toContain('No Onion')
    expect(html).toContain('Ready in about 20 min')
  })
  it('leaves out lines that do not apply', () => {
    const { text } = renderOrderEmail('received', data({ discountCents: 0, promoCode: null, taxCents: 0, deliveryFeeCents: 0, tipCents: 0, total: 30 }))
    expect(text).not.toMatch(/Discount|Tax|Delivery:|Tip/)
    expect(text).toContain('Total: $30.00')
  })
  it('escapes restaurant and guest text in the HTML', () => {
    const { html } = renderOrderEmail('received', data())
    expect(html).not.toContain('<b>')
    expect(html).toContain('Burger &lt;b&gt;')
    expect(html).toContain('Well done &amp; hot')
    expect(html).toContain('Joe&#39;s &quot;Diner&quot;')
    expect(html).not.toContain(NAME)
  })
  it('shows the scheduled time instead of the ETA, in the restaurant zone', () => {
    const { text } = renderOrderEmail('received', data({ scheduledFor: '2026-11-17T00:30:00.000Z' }))
    expect(text).toMatch(/Scheduled for: Nov 16, 2026,.*7:30\sPM/)
    expect(text).not.toContain('Ready in about')
  })
  it('the ready email depends on the order type', () => {
    expect(renderOrderEmail('ready', data()).text).toContain('Come and pick it up.')
    expect(renderOrderEmail('ready', data({ orderType: 'delivery' })).text).toContain('on its way')
    expect(renderOrderEmail('ready', data()).subject).toBe(`Your order #A1B2C3D4 is ready · ${NAME}`)
  })
  it('uses the menu language stored on the order, English otherwise', () => {
    expect(renderOrderEmail('received', data({ lang: 'pt', currency: 'BRL' })).subject).toContain('Pedido recebido')
    expect(renderOrderEmail('ready', data({ lang: 'es' })).text).toContain('Tu pedido está listo')
    expect(renderOrderEmail('ready', data({ lang: 'ja' })).text).toContain('Your order is ready')
  })
  it('ignores an unsafe logo URL or colour', () => {
    const { html } = renderOrderEmail('received', data({ restaurant: { name: 'X', logoUrl: 'javascript:alert(1)', primaryColor: 'red;}</style>', phone: null, address: null } }))
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('</style>')
    expect(html).toContain('#111111')
  })
})

describe('buildEmailData', () => {
  const order = { id: ORDER_ID, customer_email: 'Guest@Example.com', customer_language: 'pt', order_type: 'pickup', subtotal: '30.00', total: '30.00', currency: 'USD', delivery_fee_cents: 0, tip_cents: 0, scheduled_for: '2026-11-17T00:30:00Z' }
  it('turns the rows into email data, with option labels and ingredient changes', () => {
    const built = buildEmailData({
      order,
      items: [{ product_name: 'Pizza', quantity: 1, unit_price: '30.00', selected_options: { Size: 'Large', Empty: '' }, notes: null, ingredient_modifications: { removed: [{ ingredient_id: 'x', name: 'Onion' }], extras: [], added: [] } }],
      settings: { logo_url: 'https://cdn.example.com/l.png', primary_color: '#112233', phone: '555', address: '1 Main', city: 'Town', country: 'US', currency: 'USD', pickup_eta_minutes: 15 },
      tenantName: 'Joe',
    })
    expect(built).toMatchObject({ email: 'guest@example.com', lang: 'pt', total: 30, etaMinutes: 15, scheduledFor: '2026-11-17T00:30:00.000Z' })
    expect(built?.items[0].details[0]).toBe('Size: Large')
    expect(built?.items[0].details[1]).toContain('Onion')
    expect(built?.restaurant).toMatchObject({ name: 'Joe', address: '1 Main, Town', logoUrl: 'https://cdn.example.com/l.png' })
  })
  it('returns null without a usable email', () => {
    expect(buildEmailData({ order: { ...order, customer_email: null }, items: [], settings: null, tenantName: 'Joe' })).toBeNull()
  })
})
