/**
 * Legacy (Supabase) reads and writes for scheduled orders. PostgREST cannot ask
 * information_schema, so "schema applied" is "the new columns can be selected".
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { SCHEDULING_NOT_READY, schedulingTimeZone, type Hours, type SchedulingState } from './scheduled-orders'

type SettingsRow = {
  scheduled_orders_enabled?: boolean | null; business_hours?: Hours; country?: string | null; region?: string | null
  currency?: string | null; pickup_eta_minutes?: number | null
}

export async function legacyScheduling(service: SupabaseClient, tenantId: string, productIds: string[]): Promise<SchedulingState> {
  const { data: settings, error } = await service.from('tenant_settings')
    .select('scheduled_orders_enabled, business_hours, country, region, currency, pickup_eta_minutes').eq('tenant_id', tenantId).maybeSingle()
  if (error) return SCHEDULING_NOT_READY
  const { data: products, error: productsError } = await service.from('products')
    .select('id, min_notice_minutes').eq('tenant_id', tenantId).in('id', productIds)
  if (productsError) return SCHEDULING_NOT_READY
  const row = (settings ?? null) as SettingsRow | null
  const notice = Math.max(0, ...((products ?? []) as Array<{ min_notice_minutes?: number | null }>).map((p) => Number(p.min_notice_minutes ?? 0)))
  return {
    ready: true,
    enabled: row?.scheduled_orders_enabled === true,
    hours: row?.business_hours ?? null,
    timeZone: schedulingTimeZone({ country: row?.country, region: row?.region, currency: row?.currency }),
    prepMinutes: Number(row?.pickup_eta_minutes ?? 0) || 0,
    maxNoticeMinutes: Number.isFinite(notice) ? notice : 0,
  }
}

/** Writes the time onto a just-created order (the order RPC predates this column). */
export async function legacyRecordScheduledFor(service: SupabaseClient, tenantId: string, orderId: string, scheduledFor: string) {
  return service.from('orders').update({ scheduled_for: scheduledFor }).eq('id', orderId).eq('tenant_id', tenantId)
}
