/**
 * Where the customer order emails get their data and how they are triggered.
 * `buildEmailData` is pure (shared by the owned SQL store and the legacy
 * Supabase store); `notifyOrderEmail` is the one call the order flows make
 * after their change is committed. It never throws.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { getMenuCopy } from '@/components/menu/menu-i18n'
import { summarizeIngredientMods } from '@/components/menu/menu-utils'
import type { IngredientModifications } from '@/types/database'
import { schedulingTimeZone } from './scheduled-orders'
import { orderEmailMode, sendOrderEmail, type OrderEmailData, type OrderEmailKind, type OrderEmailStore } from './order-emails'
import { normalizeEmail } from './order-contact'

/** Statuses in which each email makes sense; also what makes a retry harmless. */
export const EMAIL_STATUSES: Record<OrderEmailKind, readonly string[]> = {
  received: ['pending', 'paid', 'preparing'],
  ready: ['ready'],
}
export const EMAIL_COLUMN: Record<OrderEmailKind, 'receipt_email_sent_at' | 'ready_email_sent_at'> = {
  received: 'receipt_email_sent_at',
  ready: 'ready_email_sent_at',
}

type Row = Record<string, unknown>
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const num = (v: unknown): number => { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0 }

export interface EmailSource {
  order: Row
  items: Row[]
  settings: Row | null
  tenantName: string | null
}

export function buildEmailData(src: EmailSource): OrderEmailData | null {
  const { order, settings } = src
  const email = normalizeEmail(order.customer_email)
  const orderId = str(order.id)
  if (!email || !orderId) return null
  const lang = str(order.customer_language)
  const copy = getMenuCopy(lang)
  const place = (...parts: unknown[]) => parts.map(str).filter(Boolean).join(', ')
  const items = src.items.map(item => {
    const options = item.selected_options && typeof item.selected_options === 'object'
      ? Object.entries(item.selected_options as Row).filter(([, v]) => v).map(([k, v]) => `${k}: ${String(v)}`)
      : []
    return {
      name: str(item.product_name) ?? '',
      quantity: num(item.quantity),
      unitPrice: num(item.unit_price),
      details: [...options, ...summarizeIngredientMods(item.ingredient_modifications as IngredientModifications | null | undefined, {
        withoutNamed: copy.withoutNamed, extraNamed: copy.extraNamed, addedNamed: copy.addedNamed,
      })],
      notes: str(item.notes),
    }
  })
  const scheduled = order.scheduled_for ? new Date(order.scheduled_for as string | Date) : null
  return {
    orderId,
    email,
    lang,
    orderType: str(order.order_type),
    scheduledFor: scheduled && Number.isFinite(scheduled.getTime()) ? scheduled.toISOString() : null,
    timeZone: settings ? schedulingTimeZone({ country: str(settings.country), region: str(settings.region), currency: str(settings.currency) }) : null,
    etaMinutes: settings && num(settings.pickup_eta_minutes) > 0 ? num(settings.pickup_eta_minutes) : null,
    currency: str(order.currency) ?? str(settings?.currency) ?? 'USD',
    subtotal: num(order.subtotal),
    discountCents: num(order.discount_cents),
    promoCode: str(order.promo_code),
    taxCents: num(order.tax_cents),
    deliveryFeeCents: num(order.delivery_fee_cents),
    tipCents: num(order.tip_cents),
    total: num(order.total),
    items,
    deliveryAddress: str(order.delivery_address),
    restaurant: {
      name: src.tenantName ?? 'Restaurant',
      logoUrl: str(settings?.logo_url),
      primaryColor: str(settings?.primary_color),
      phone: str(settings?.phone),
      address: place(settings?.address, settings?.city, settings?.region, settings?.postal_code) || null,
    },
  }
}

/** Legacy (Supabase) store: PostgREST, with the same conditional claim. */
export function legacyOrderEmailStore(service: SupabaseClient, tenantId: string, capable: () => Promise<boolean>): OrderEmailStore {
  return {
    async claim(orderId, kind) {
      if (!(await capable())) return null
      const column = EMAIL_COLUMN[kind]
      // The schema step may not have run: the update then fails and nothing is sent.
      const { data: claimed, error } = await service.from('orders')
        .update({ [column]: new Date().toISOString() })
        .eq('tenant_id', tenantId).eq('id', orderId).is(column, null).not('customer_email', 'is', null)
        .in('status', [...EMAIL_STATUSES[kind]])
        .select('*')
      if (error || !claimed || claimed.length !== 1) return null
      const [{ data: items }, { data: settings }, { data: tenant }] = await Promise.all([
        service.from('order_items').select('product_name, quantity, unit_price, selected_options, notes, ingredient_modifications').eq('order_id', orderId).order('id').limit(200),
        service.from('tenant_settings').select('*').eq('tenant_id', tenantId).maybeSingle(),
        service.from('tenants').select('name').eq('id', tenantId).maybeSingle(),
      ])
      return buildEmailData({ order: claimed[0] as Row, items: (items ?? []) as Row[], settings: (settings ?? null) as Row | null, tenantName: (tenant as { name?: string } | null)?.name ?? null })
    },
    async release(orderId, kind) {
      await service.from('orders').update({ [EMAIL_COLUMN[kind]]: null }).eq('tenant_id', tenantId).eq('id', orderId)
    },
  }
}

/**
 * After an order flow committed (created, paid, moved to ready): send the matching
 * email if the order has an address and the restaurant takes guest orders. Awaited
 * by callers, but it never throws and never blocks longer than the fetch timeout.
 */
export async function notifyOrderEmail(tenantId: string | null | undefined, orderId: string | null | undefined, kind: OrderEmailKind): Promise<void> {
  try {
    if (!tenantId || !orderId) return
    // Off (no key, or development): log once and stop before touching the database.
    if (!orderEmailMode().send) { await sendOrderEmail({ claim: async () => null, release: async () => {} }, orderId, kind); return }
    // The data layers are imported lazily: they pull in the database drivers.
    const { ordersDataOwned } = await import('@/lib/data/orders')
    if (ordersDataOwned()) {
      const { withOwnedOrders } = await import('@/lib/data/orders-runtime')
      const store: OrderEmailStore = {
        claim: (id, k) => withOwnedOrders(tenantId, true, repo => repo.claimEmail(id, k)),
        release: (id, k) => withOwnedOrders(tenantId, true, repo => repo.releaseEmail(id, k)),
      }
      await sendOrderEmail(store, orderId, kind)
      return
    }
    const { createServiceClient } = await import('@/lib/supabase/server')
    const { getTenantCapabilities } = await import('@/lib/tenant-plan')
    const service = await createServiceClient()
    await sendOrderEmail(legacyOrderEmailStore(service, tenantId, async () => (await getTenantCapabilities(tenantId, undefined, service)).guestOrdering), orderId, kind)
  } catch {
    // Logged by sendOrderEmail where it matters; an email problem never reaches the order flow.
  }
}
