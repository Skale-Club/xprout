/**
 * Legacy (Supabase) reads for tax and promo codes. PostgREST cannot ask
 * information_schema, so "schema applied" is "the tax column can be selected".
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { TAX_PROMO_NOT_READY, type PromoCodeRow, type TaxPromoState } from './tax-promo'

export async function legacyTaxPromo(service: SupabaseClient, tenantId: string, code: string | null): Promise<TaxPromoState> {
  const { data: settings, error } = await service.from('tenant_settings').select('tax_rate_bps').eq('tenant_id', tenantId).maybeSingle()
  if (error) return TAX_PROMO_NOT_READY
  const taxBps = Number((settings as { tax_rate_bps?: number } | null)?.tax_rate_bps ?? 0)
  let promo: PromoCodeRow | null = null
  if (code) {
    const { data, error: promoError } = await service
      .from('promo_codes')
      .select('id, code, kind, value, starts_at, ends_at, is_active')
      .eq('tenant_id', tenantId)
      .eq('code', code)
      .maybeSingle()
    if (promoError) return TAX_PROMO_NOT_READY
    promo = (data as PromoCodeRow | null) ?? null
  }
  return { ready: true, taxBps: Number.isInteger(taxBps) ? taxBps : 0, promo }
}

/** Writes the breakdown onto a just-created order (the order RPC predates these columns). */
export async function legacyRecordTaxPromo(
  service: SupabaseClient,
  tenantId: string,
  orderId: string,
  values: { discountCents: number; taxCents: number; promoCode: string | null },
) {
  return service.from('orders')
    .update({ discount_cents: values.discountCents, tax_cents: values.taxCents, promo_code: values.promoCode })
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
}
