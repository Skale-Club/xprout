import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getTenantCapabilities } from '@/lib/tenant-plan'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { withApi } from '@/lib/observability/with-api'
import { ordersDataOwned } from '@/lib/data/orders'
import { withOwnedOrders } from '@/lib/data/orders-runtime'
import { legacyTaxPromo } from '@/lib/orders/tax-promo-legacy'
import { discountCents, normalizePromoCode, promoRejection, type TaxPromoState } from '@/lib/orders/tax-promo'

export const dynamic = 'force-dynamic'

const schema = z.object({
  tenant_id: z.string().uuid(),
  code: z.string().max(64),
  // Display preview only; POST /api/orders recomputes everything from the catalog.
  subtotal_cents: z.number().int().min(0).max(100_000_000),
})

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

/** Checks a promo code for a restaurant and previews its discount on a subtotal. */
async function handlePOST(request: Request) {
  const limited = await rateLimit('promo-validate', getClientIp(request), 20, '1 m')
  if (!limited.ok) return json({ error: 'Too many requests. Please slow down.' }, 429)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: 'Invalid request' }, 400)
  const { tenant_id, subtotal_cents } = parsed.data
  const code = normalizePromoCode(parsed.data.code)
  if (!code) return json({ valid: false })

  const read = async (): Promise<TaxPromoState | null> => {
    if (ordersDataOwned()) {
      return withOwnedOrders(tenant_id, false, async owned => {
        const tenant = (await owned.tenantSettings()).data
        if (!tenant?.is_active || !tenant.tenant_settings?.orders_enabled) return null
        if (!(await owned.capabilities(tenant.tenant_settings)).guestOrdering) return null
        return owned.taxPromo(code)
      })
    }
    const service = createServiceClient()
    const { data: tenant } = await service.from('tenants')
      .select('id, tenant_settings(orders_enabled, direct_orders_enabled, table_management_enabled, whatsapp_orders_enabled, whatsapp, tips_enabled, item_notes_enabled, ingredient_customization_enabled, dine_in_enabled, pickup_enabled, delivery_enabled, upsell_enabled)')
      .eq('id', tenant_id).eq('is_active', true).maybeSingle()
    const raw = tenant?.tenant_settings as unknown
    const settings = (Array.isArray(raw) ? raw[0] : raw) as Parameters<typeof getTenantCapabilities>[1] | null
    if (!tenant || !settings || !(settings as { orders_enabled?: boolean }).orders_enabled) return null
    if (!(await getTenantCapabilities(tenant_id, settings, service)).guestOrdering) return null
    return legacyTaxPromo(service, tenant_id, code)
  }

  const state = await read()
  if (!state?.ready || promoRejection(state.promo, new Date())) return json({ valid: false })
  const discount = discountCents(subtotal_cents, state.promo!)
  return json({ valid: discount > 0, code: state.promo!.code, kind: state.promo!.kind, value: state.promo!.value, discount_cents: discount })
}

export const POST = withApi('POST /api/promo-codes/validate', handlePOST)
