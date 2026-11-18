/**
 * Legacy (Supabase) read of the checkout name and email modes. PostgREST cannot
 * ask information_schema, so "schema applied" is "the columns can be selected";
 * until then the defaults apply.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_CHECKOUT_FIELDS, checkoutFieldsFrom, type CheckoutFields } from './checkout-fields'

export async function legacyCheckoutFields(service: SupabaseClient, tenantId: string): Promise<CheckoutFields> {
  const { data, error } = await service.from('tenant_settings').select('checkout_name_mode, checkout_email_mode').eq('tenant_id', tenantId).maybeSingle()
  if (error) return DEFAULT_CHECKOUT_FIELDS
  return checkoutFieldsFrom(data as Record<string, unknown> | null)
}
