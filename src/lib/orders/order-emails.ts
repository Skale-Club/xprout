/**
 * Customer order emails: "Order received" (the kitchen has the order) and
 * "Order ready". Plain light HTML plus a text part, in the guest's menu language
 * when the order stored one (English, Portuguese and Spanish; anything else is
 * English), sent through Resend with a plain fetch.
 *
 * Rules: never sent in development (outbound effects are off) unless
 * ORDER_EMAILS_IN_DEVELOPMENT=true; never throws into the order or status flow;
 * at most once per order and kind (the store claims the order's *_email_sent_at
 * stamp with a conditional UPDATE before sending and releases it if sending fails).
 *
 * Schema: docs/owned-schema/20261116150000_order_contact_and_tickets.sql.
 */
import { formatMoney, localeFor } from '@/components/menu/menu-i18n'
import { log } from '@/lib/observability/log'

export type OrderEmailKind = 'received' | 'ready'

export interface OrderEmailItem {
  name: string
  quantity: number
  unitPrice: number
  /** Option labels and ingredient changes, already readable. */
  details: string[]
  notes: string | null
}

export interface OrderEmailData {
  orderId: string
  email: string
  lang: string | null
  orderType: string | null
  scheduledFor: string | null
  timeZone: string | null
  /** Preparation time for an ASAP order. */
  etaMinutes: number | null
  currency: string
  subtotal: number
  discountCents: number
  promoCode: string | null
  taxCents: number
  deliveryFeeCents: number
  tipCents: number
  total: number
  items: OrderEmailItem[]
  deliveryAddress: string | null
  restaurant: { name: string; logoUrl: string | null; primaryColor: string | null; phone: string | null; address: string | null }
}

/** Claims the order's email stamp and returns what to send, or null when there is nothing to send. */
export interface OrderEmailStore {
  claim(orderId: string, kind: OrderEmailKind): Promise<OrderEmailData | null>
  release(orderId: string, kind: OrderEmailKind): Promise<void>
}

type Env = Record<string, string | undefined>

export function orderEmailMode(env: Env = process.env): { send: true } | { send: false; reason: string } {
  if (!env.RESEND_API_KEY) return { send: false, reason: 'RESEND_API_KEY is not set' }
  if (!env.ORDER_EMAIL_FROM) return { send: false, reason: 'ORDER_EMAIL_FROM is not set' }
  if (env.NODE_ENV !== 'production' && env.ORDER_EMAILS_IN_DEVELOPMENT !== 'true') return { send: false, reason: 'outbound emails are off outside production' }
  return { send: true }
}

let loggedOff = false
export function resetOrderEmailLogForTests() { loggedOff = false }

// ── Copy ────────────────────────────────────────────────────────────────────

interface Copy {
  receivedSubject: string; receivedTitle: string; receivedBody: string
  readySubject: string; readyTitle: string; readyPickup: string; readyDelivery: string; readyDineIn: string
  order: string; scheduledFor: string; readyIn: string
  subtotal: string; discount: string; tax: string; delivery: string; tip: string; total: string
  pickup: string; deliveryType: string; dineIn: string; deliverTo: string; notes: string
}

const COPY: Record<'en' | 'pt' | 'es', Copy> = {
  en: {
    receivedSubject: 'Order received #{n} · {name}', receivedTitle: 'We got your order', receivedBody: '{name} has received your order and is on it.',
    readySubject: 'Your order #{n} is ready · {name}', readyTitle: 'Your order is ready', readyPickup: 'Come and pick it up.', readyDelivery: 'It is on its way to you.', readyDineIn: 'We are bringing it to you.',
    order: 'Order', scheduledFor: 'Scheduled for', readyIn: 'Ready in about {min} min',
    subtotal: 'Subtotal', discount: 'Discount', tax: 'Tax', delivery: 'Delivery', tip: 'Tip', total: 'Total',
    pickup: 'Pickup', deliveryType: 'Delivery', dineIn: 'Dine in', deliverTo: 'Delivering to', notes: 'Note',
  },
  pt: {
    receivedSubject: 'Pedido recebido #{n} · {name}', receivedTitle: 'Recebemos o seu pedido', receivedBody: '{name} recebeu o seu pedido e já está cuidando dele.',
    readySubject: 'Seu pedido #{n} está pronto · {name}', readyTitle: 'Seu pedido está pronto', readyPickup: 'Pode vir retirar.', readyDelivery: 'Ele está a caminho.', readyDineIn: 'Estamos levando até você.',
    order: 'Pedido', scheduledFor: 'Agendado para', readyIn: 'Pronto em cerca de {min} min',
    subtotal: 'Subtotal', discount: 'Desconto', tax: 'Imposto', delivery: 'Entrega', tip: 'Gorjeta', total: 'Total',
    pickup: 'Retirada', deliveryType: 'Entrega', dineIn: 'No local', deliverTo: 'Entregando em', notes: 'Obs.',
  },
  es: {
    receivedSubject: 'Pedido recibido #{n} · {name}', receivedTitle: 'Recibimos tu pedido', receivedBody: '{name} recibió tu pedido y ya está en ello.',
    readySubject: 'Tu pedido #{n} está listo · {name}', readyTitle: 'Tu pedido está listo', readyPickup: 'Puedes pasar a recogerlo.', readyDelivery: 'Va en camino.', readyDineIn: 'Te lo llevamos a la mesa.',
    order: 'Pedido', scheduledFor: 'Programado para', readyIn: 'Listo en unos {min} min',
    subtotal: 'Subtotal', discount: 'Descuento', tax: 'Impuesto', delivery: 'Envío', tip: 'Propina', total: 'Total',
    pickup: 'Para recoger', deliveryType: 'Entrega a domicilio', dineIn: 'En el local', deliverTo: 'Entregando en', notes: 'Nota',
  },
}

function copyFor(lang: string | null): { copy: Copy; lang: string } {
  const base = (lang ?? 'en').split('-')[0]
  return base === 'pt' || base === 'es' ? { copy: COPY[base], lang: base } : { copy: COPY.en, lang: 'en' }
}

const say = (template: string, vars: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`))

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** "A1B2C3D4", the same number the guest saw at checkout. */
export function orderNumber(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase()
}

function safeColor(value: string | null): string {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#111111'
}

function safeUrl(value: string | null): string | null {
  return value && /^https:\/\/[^\s"'<>]+$/.test(value) ? value : null
}

function scheduledText(iso: string, timeZone: string | null, lang: string): string {
  try {
    return new Intl.DateTimeFormat(localeFor(lang), { dateStyle: 'medium', timeStyle: 'short', ...(timeZone ? { timeZone } : {}) }).format(new Date(iso))
  } catch {
    return iso
  }
}

export interface RenderedEmail { subject: string; html: string; text: string }

export function renderOrderEmail(kind: OrderEmailKind, d: OrderEmailData): RenderedEmail {
  const { copy, lang } = copyFor(d.lang)
  const money = (v: number) => formatMoney(v, d.currency, lang)
  const cents = (v: number) => money(v / 100)
  const n = orderNumber(d.orderId)
  const name = d.restaurant.name
  const title = kind === 'received' ? copy.receivedTitle : copy.readyTitle
  const readyLine = d.orderType === 'delivery' ? copy.readyDelivery : d.orderType === 'dine_in' ? copy.readyDineIn : copy.readyPickup
  const intro = kind === 'received' ? say(copy.receivedBody, { name }) : readyLine
  const subject = say(kind === 'received' ? copy.receivedSubject : copy.readySubject, { n, name })
  const typeLabel = d.orderType === 'delivery' ? copy.deliveryType : d.orderType === 'dine_in' ? copy.dineIn : d.orderType === 'pickup' ? copy.pickup : null
  const when = d.scheduledFor
    ? `${copy.scheduledFor}: ${scheduledText(d.scheduledFor, d.timeZone, lang)}`
    : kind === 'received' && d.etaMinutes ? say(copy.readyIn, { min: d.etaMinutes }) : null

  const lines: Array<[string, string]> = [[copy.subtotal, money(d.subtotal)]]
  if (d.discountCents > 0) lines.push([`${copy.discount}${d.promoCode ? ` (${d.promoCode})` : ''}`, `-${cents(d.discountCents)}`])
  if (d.taxCents > 0) lines.push([copy.tax, cents(d.taxCents)])
  if (d.deliveryFeeCents > 0) lines.push([copy.delivery, cents(d.deliveryFeeCents)])
  if (d.tipCents > 0) lines.push([copy.tip, cents(d.tipCents)])
  lines.push([copy.total, money(d.total)])

  const contact = [d.restaurant.address, d.restaurant.phone].filter((v): v is string => !!v)
  const accent = safeColor(d.restaurant.primaryColor)
  const logo = safeUrl(d.restaurant.logoUrl)
  const addressLine = d.deliveryAddress && d.orderType === 'delivery' ? `${copy.deliverTo}: ${d.deliveryAddress}` : null

  const itemsHtml = d.items.map(i => `<tr><td style="padding:6px 0;vertical-align:top">${i.quantity}× ${escapeHtml(i.name)}${
    i.details.map(x => `<div style="color:#666;font-size:13px">${escapeHtml(x)}</div>`).join('')}${
    i.notes ? `<div style="color:#666;font-size:13px">${escapeHtml(copy.notes)}: ${escapeHtml(i.notes)}</div>` : ''
  }</td><td style="padding:6px 0;text-align:right;vertical-align:top;white-space:nowrap">${escapeHtml(money(i.unitPrice * i.quantity))}</td></tr>`).join('')
  const totalsHtml = lines.map(([k, v], idx) => {
    const style = idx === lines.length - 1 ? 'font-weight:700;border-top:1px solid #e5e5e5' : 'color:#555'
    return `<tr><td style="padding:3px 0;${style}">${escapeHtml(k)}</td><td style="padding:3px 0;text-align:right;${style}">${escapeHtml(v)}</td></tr>`
  }).join('')

  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#111">
<div style="max-width:520px;margin:0 auto;background:#fff;padding:24px">
${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(name)}" height="40" style="display:block;margin:0 0 12px;max-height:40px">` : `<div style="font-weight:700;font-size:16px;margin-bottom:12px">${escapeHtml(name)}</div>`}
<div style="border-top:3px solid ${accent};padding-top:16px">
<h1 style="font-size:22px;margin:0 0 8px">${escapeHtml(title)}</h1>
<p style="margin:0 0 16px;color:#333">${escapeHtml(intro)}</p>
<p style="margin:0 0 16px;font-size:14px;color:#333"><strong>${escapeHtml(copy.order)} #${n}</strong>${typeLabel ? ` · ${escapeHtml(typeLabel)}` : ''}${when ? `<br>${escapeHtml(when)}` : ''}${addressLine ? `<br>${escapeHtml(addressLine)}` : ''}</p>
<table role="presentation" width="100%" style="border-collapse:collapse;font-size:15px">${itemsHtml}</table>
<table role="presentation" width="100%" style="border-collapse:collapse;font-size:15px;margin-top:8px">${totalsHtml}</table>
${contact.length ? `<p style="margin:20px 0 0;font-size:13px;color:#666">${contact.map(escapeHtml).join('<br>')}</p>` : ''}
</div></div></body></html>`

  const text = [
    title, '', intro, '',
    `${copy.order} #${n}${typeLabel ? ` · ${typeLabel}` : ''}`,
    ...(when ? [when] : []),
    ...(addressLine ? [addressLine] : []),
    '',
    ...d.items.flatMap(i => [`${i.quantity}x ${i.name}  ${money(i.unitPrice * i.quantity)}`, ...i.details.map(x => `   ${x}`), ...(i.notes ? [`   ${copy.notes}: ${i.notes}`] : [])]),
    '',
    ...lines.map(([k, v]) => `${k}: ${v}`),
    ...(contact.length ? ['', name, ...contact] : []),
  ].join('\n')

  return { subject, html, text }
}

export interface SendDeps {
  env?: Env
  fetchImpl?: typeof fetch
}

/**
 * Sends one email for an order, at most once per kind. Never throws: a failure
 * is logged and the claim is released so a later retry can still send it.
 * Resolves true when an email went out.
 */
export async function sendOrderEmail(store: OrderEmailStore, orderId: string, kind: OrderEmailKind, deps: SendDeps = {}): Promise<boolean> {
  const env = deps.env ?? process.env
  let claimed = false
  try {
    const mode = orderEmailMode(env)
    if (!mode.send) {
      if (!loggedOff) { loggedOff = true; log.info('orders.email_off', { reason: mode.reason }) }
      return false
    }
    const data = await store.claim(orderId, kind)
    if (!data) return false
    claimed = true
    const mail = renderOrderEmail(kind, data)
    const response = await (deps.fetchImpl ?? fetch)('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${data.restaurant.name.replace(/[<>"\r\n]/g, '').trim() || 'Orders'} <${env.ORDER_EMAIL_FROM}>`,
        to: [data.email],
        subject: mail.subject, html: mail.html, text: mail.text,
      }),
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error(`Resend answered ${response.status}`)
    return true
  } catch (err) {
    log.error('orders.email_error', { err, order_id: orderId, kind })
    if (claimed) await store.release(orderId, kind).catch(() => {})
    return false
  }
}
