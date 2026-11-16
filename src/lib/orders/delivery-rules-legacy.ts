/**
 * Legacy (Supabase) reads for the own-delivery rules. PostgREST cannot ask
 * information_schema, so "schema applied" is "the new columns can be selected".
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { DELIVERY_RULES_NOT_READY, type DeliveryRulesState } from './delivery-rules'

export async function legacyDeliveryRules(service: SupabaseClient, tenantId: string): Promise<DeliveryRulesState> {
  const { data: settings, error } = await service.from('tenant_settings').select('delivery_zones_only').eq('tenant_id', tenantId).maybeSingle()
  if (error) return DELIVERY_RULES_NOT_READY
  const { data: zones, error: zonesError } = await service.from('delivery_zones').select('id, min_order_cents').eq('tenant_id', tenantId).eq('is_active', true)
  if (zonesError) return DELIVERY_RULES_NOT_READY
  const minByZone: Record<string, number> = {}
  for (const zone of (zones ?? []) as Array<{ id: string; min_order_cents?: number | null }>) minByZone[zone.id] = Number(zone.min_order_cents ?? 0) || 0
  return { ready: true, zonesOnly: (settings as { delivery_zones_only?: boolean } | null)?.delivery_zones_only === true, minByZone }
}
