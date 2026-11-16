import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { KitchenTicket } from '@/app/(admin)/orders/KitchenTicket'

const order = {
  id: 'a1b2c3d4-0000-4000-8000-000000000001', status: 'pending', customer_name: 'Maria', total: 36.16, created_at: '2026-11-16T18:05:00Z',
  order_type: 'delivery', table_name: null, scheduled_for: null,
  delivery_street: '1 Main St', delivery_complement: 'Apt 2', delivery_zipcode: '10001', delivery_city: 'New York', delivery_notes: 'Ring twice',
  tip_cents: 400, discount_cents: 300, promo_code: 'SAVE10', tax_cents: 216, delivery_fee_cents: 500,
  order_items: [
    { id: 'i1', product_name: 'Burger', quantity: 2, selected_options: { Size: 'Large' }, notes: 'No sauce <b>', ingredient_modifications: { removed: [{ ingredient_id: 'x', name: 'Onion' }], extras: [], added: [] } },
  ],
}
const render = (extra: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(KitchenTicket, {
  order: { ...order, ...extra } as never, restaurantName: 'Joe Diner', timeZone: 'America/New_York', formatMoney: v => `$${v.toFixed(2)}`,
}))

describe('kitchen ticket', () => {
  it('prints what the kitchen needs, large and plain', () => {
    const html = render()
    for (const part of ['Joe Diner', '#A1B2C3D4', 'DELIVERY', 'Maria', 'ASAP', 'Placed 1:05 PM', '2× Burger', 'Size: Large', 'No Onion', 'NOTE: No sauce &lt;b&gt;', '1 Main St, Apt 2', '10001 New York', 'Ring twice']) {
      expect(html).toContain(part)
    }
    for (const part of ['Discount (SAVE10): -$3.00', 'Tax: $2.16', 'Delivery: $5.00', 'Tip: $4.00', 'TOTAL $36.16']) expect(html).toContain(part)
  })
  it('shows a scheduled badge instead of ASAP and the table for dine-in', () => {
    const html = render({ scheduled_for: '2026-11-17T00:30:00Z', order_type: 'dine_in', table_name: 'Table 4' })
    expect(html).toContain('kds-ticket-badge')
    expect(html).toContain('FOR Mon, Nov 16, 7:30 PM')
    expect(html).not.toContain('ASAP')
    expect(html).toContain('DINE IN · Table 4')
    expect(html).not.toContain('1 Main St')
  })
})
