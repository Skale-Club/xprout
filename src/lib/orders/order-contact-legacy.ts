/**
 * Legacy (Supabase) reads and writes for the order contact fields. PostgREST cannot
 * ask information_schema, so "schema applied" is "the new columns can be selected".
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { OrderContactValues } from './order-contact'

export async function legacyContactReady(service: SupabaseClient): Promise<boolean> {
  const { error } = await service.from('orders')
    .select('customer_email, customer_language, receipt_email_sent_at, ready_email_sent_at, marketing_sms_opt_in, marketing_email_opt_in').limit(1)
  return !error
}

/** Writes the contact fields onto a just-created order (the order RPC predates these columns). */
export async function legacyRecordContact(service: SupabaseClient, tenantId: string, orderId: string, values: OrderContactValues) {
  return service.from('orders')
    .update({ customer_email: values.email, customer_language: values.language, marketing_sms_opt_in: values.smsOptIn, marketing_email_opt_in: values.emailOptIn })
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
}
