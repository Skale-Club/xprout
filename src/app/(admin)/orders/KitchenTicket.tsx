'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Order, OrderItem } from '@/types/database'
import { summarizeIngredientMods, summarizeOptions } from '@/components/menu/menu-utils'

type TicketOrder = Order & { order_items: OrderItem[] }
type Extra = {
  order_type?: string | null; table_name?: string | null; scheduled_for?: string | null
  delivery_street?: string | null; delivery_complement?: string | null; delivery_zipcode?: string | null; delivery_city?: string | null
  delivery_notes?: string | null; delivery_address?: string | null; tip_cents?: number | null; discount_cents?: number | null
  tax_cents?: number | null; delivery_fee_cents?: number | null; promo_code?: string | null
}

const TYPE_LABEL: Record<string, string> = { dine_in: 'DINE IN', pickup: 'PICKUP', delivery: 'DELIVERY' }

/** 80 mm kitchen ticket, shown only while printing (see the @media print rules below). */
export function KitchenTicket({ order, restaurantName, timeZone, formatMoney }: {
  order: TicketOrder; restaurantName: string | null; timeZone: string | null; formatMoney: (value: number) => string
}) {
  const o = order as TicketOrder & Extra
  const zone = timeZone || undefined
  const placed = new Date(o.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: zone })
  const scheduledMs = o.scheduled_for ? Date.parse(o.scheduled_for) : NaN
  const when = Number.isFinite(scheduledMs)
    ? `FOR ${new Date(scheduledMs).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: zone })}`
    : 'ASAP'
  const address = o.order_type === 'delivery'
    ? [[o.delivery_street, o.delivery_complement].filter(Boolean).join(', ') || o.delivery_address, [o.delivery_zipcode, o.delivery_city].filter(Boolean).join(' ')].filter(Boolean)
    : []
  const money = (cents: number | null | undefined) => formatMoney((cents ?? 0) / 100)
  return (
    <div className="kds-ticket" data-testid="kitchen-ticket">
      {restaurantName && <p className="kds-ticket-name">{restaurantName}</p>}
      <p className="kds-ticket-number">#{o.id.slice(0, 8).toUpperCase()}</p>
      <p className="kds-ticket-big">{TYPE_LABEL[o.order_type ?? ''] ?? 'ORDER'}{o.table_name ? ` · ${o.table_name}` : ''}</p>
      <p className="kds-ticket-big">{o.customer_name}</p>
      <p className={Number.isFinite(scheduledMs) ? 'kds-ticket-badge' : 'kds-ticket-big'}>{when}</p>
      <p>Placed {placed}</p>
      {address.length > 0 && <div className="kds-ticket-block">{address.map(line => <p key={line as string}>{line}</p>)}{o.delivery_notes && <p>{o.delivery_notes}</p>}</div>}
      <hr />
      {o.order_items.map(item => {
        const lines = [
          item.selected_options ? summarizeOptions(item.selected_options) : '',
          ...summarizeIngredientMods(item.ingredient_modifications),
        ].filter(Boolean)
        return (
          <div key={item.id} className="kds-ticket-item">
            <p className="kds-ticket-big">{item.quantity}× {item.product_name}</p>
            {lines.map(line => <p key={line} className="kds-ticket-detail">{line}</p>)}
            {item.notes && <p className="kds-ticket-detail">NOTE: {item.notes}</p>}
          </div>
        )
      })}
      <hr />
      {(o.discount_cents ?? 0) > 0 && <p>Discount{o.promo_code ? ` (${o.promo_code})` : ''}: -{money(o.discount_cents)}</p>}
      {(o.tax_cents ?? 0) > 0 && <p>Tax: {money(o.tax_cents)}</p>}
      {(o.delivery_fee_cents ?? 0) > 0 && <p>Delivery: {money(o.delivery_fee_cents)}</p>}
      {(o.tip_cents ?? 0) > 0 && <p>Tip: {money(o.tip_cents)}</p>}
      <p className="kds-ticket-big">TOTAL {formatMoney(Number(o.total))}</p>
      <p>{o.status === 'awaiting_payment' || o.status === 'payment_failed' ? 'NOT PAID' : o.status === 'pending' ? 'Pay at the counter' : 'Paid'}</p>
    </div>
  )
}

const PRINT_CSS = `
.kds-ticket-portal{display:none}
@media print{
  @page{size:80mm auto;margin:3mm}
  body>*:not(.kds-ticket-portal){display:none!important}
  .kds-ticket-portal{display:block!important}
  .kds-ticket{width:72mm;color:#000;background:#fff;font:14px/1.3 ui-monospace,Menlo,Consolas,monospace}
  .kds-ticket p{margin:0 0 2px}
  .kds-ticket hr{border:0;border-top:1px dashed #000;margin:6px 0}
  .kds-ticket-name{font-size:16px;font-weight:700;text-align:center}
  .kds-ticket-number{font-size:22px;font-weight:700;text-align:center}
  .kds-ticket-big{font-size:18px;font-weight:700}
  .kds-ticket-badge{font-size:18px;font-weight:700;border:2px solid #000;padding:2px 6px;display:inline-block}
  .kds-ticket-item{margin-bottom:6px}
  .kds-ticket-detail{font-size:15px;padding-left:12px}
  .kds-ticket-block{margin:4px 0}
}`

/** Renders the ticket into <body> and opens the browser's print dialog once; the parent clears it afterwards. */
export function PrintTicket({ order, restaurantName, timeZone, formatMoney, onDone }: {
  order: TicketOrder; restaurantName: string | null; timeZone: string | null; formatMoney: (value: number) => string; onDone: () => void
}) {
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { window.print() } finally { onDone() }
    })
    return () => cancelAnimationFrame(frame)
  }, [onDone])
  return createPortal(
    <div className="kds-ticket-portal">
      <style>{PRINT_CSS}</style>
      <KitchenTicket order={order} restaurantName={restaurantName} timeZone={timeZone} formatMoney={formatMoney} />
    </div>,
    document.body,
  )
}
