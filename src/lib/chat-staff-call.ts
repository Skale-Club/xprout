/**
 * callStaff, the assistant's "tell the team" ability: creates the same waiter
 * call the menu's "Call waiter" button does (src/app/api/public/waiter-call),
 * on both data paths. Only for a guest on a table link of THIS restaurant: the
 * table id comes from the guest, so it is re-checked against the tenant (and
 * must be active) before anything is written.
 *
 * Limits: the model may call it once per turn (chat-agent.ts), at most
 * MAX_CALLS_PER_WINDOW times per conversation per window (rate-limit), and a
 * repeat while the same call is still open only re-notifies the staff (the
 * waiter-call dedupe), so it cannot flood the staff screen.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'
import { parseTableParam } from '@/lib/service-modes'
import { CALL_STALE_MS } from '@/lib/waiter-calls'
import { log } from '@/lib/observability/log'
import { createOwnedPublicWaiterCall } from '@/lib/data/public-waiter-calls-runtime'
import type { StaffCallOutcome, StaffCallReason } from '@/lib/chat-agent'

export const MAX_STAFF_CALLS_PER_WINDOW = 3

async function limited(conversationId: string): Promise<boolean> {
  const result = await rateLimit('chat-staff-call', conversationId, MAX_STAFF_CALLS_PER_WINDOW, '10 m')
  return !result.ok
}

/** Legacy (Supabase) path: the capability check already happened when the ability was resolved. */
export function legacyStaffCaller(params: { supabase: SupabaseClient; tenantId: string; tableId: unknown; conversationId: string }) {
  return async (reason: StaffCallReason): Promise<StaffCallOutcome> => {
    const tableId = parseTableParam(params.tableId)
    if (!tableId) return { ok: false, reason: 'unavailable' }
    if (await limited(params.conversationId)) return { ok: false, reason: 'limited' }
    try {
      const { supabase, tenantId } = params
      const { data: table } = await supabase.from('restaurant_tables').select('id, name').eq('id', tableId).eq('tenant_id', tenantId).eq('is_active', true).maybeSingle()
      if (!table) return { ok: false, reason: 'unavailable' }
      const { data: open } = await supabase.from('waiter_calls').select('id').eq('tenant_id', tenantId).eq('table_id', table.id).eq('reason', reason).neq('status', 'done')
        .gte('created_at', new Date(Date.now() - CALL_STALE_MS).toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (open) {
        const { error } = await supabase.from('waiter_calls').update({ status: 'open', acknowledged_at: null, acknowledged_by: null, last_called_at: new Date().toISOString() }).eq('id', open.id)
        return error ? { ok: false, reason: 'unavailable' } : { ok: true }
      }
      const { error } = await supabase.from('waiter_calls').insert({ tenant_id: tenantId, table_id: table.id, table_name: table.name, reason })
      if (error) { log.error('chat.staff_call_failed', { err: error }); return { ok: false, reason: 'unavailable' } }
      return { ok: true }
    } catch (error) {
      log.error('chat.staff_call_failed', { err: error })
      return { ok: false, reason: 'unavailable' }
    }
  }
}

/** Owned path: reuses the public waiter-call transaction (tenant by slug, table by tenant, plan rechecked). */
export function ownedStaffCaller(params: { slug: string; tableId: unknown; conversationId: string }) {
  return async (reason: StaffCallReason): Promise<StaffCallOutcome> => {
    const tableId = parseTableParam(params.tableId)
    if (!tableId) return { ok: false, reason: 'unavailable' }
    if (await limited(params.conversationId)) return { ok: false, reason: 'limited' }
    try {
      await createOwnedPublicWaiterCall(params.slug, tableId, reason)
      return { ok: true }
    } catch (error) {
      log.error('chat.staff_call_failed', { err: error })
      return { ok: false, reason: 'unavailable' }
    }
  }
}
