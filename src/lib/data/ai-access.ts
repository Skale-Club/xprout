import { AdminMenuError, type AdminMenuQuery } from './admin-menus'
import type { AiFeature, AiBillingMode } from '../ai/billing-rules'

const text = (value: unknown) => typeof value === 'string' ? value : null
function unique(rows: Record<string, unknown>[]) {
  if (rows.length > 1) throw new AdminMenuError(503, 'AI configuration is unavailable')
  return rows[0]
}

/** Ciphertext remains encrypted here; existing server access code decrypts it. */
export async function readPlatformAiRecord(query: AdminMenuQuery) {
  const row = unique((await query(`SELECT openrouter_api_key,default_billing_mode,default_markup_pct,usd_to_brl FROM public.platform_ai_settings WHERE id=1 LIMIT 2`)).rows)
  return row ? { openrouter_api_key: text(row.openrouter_api_key), default_billing_mode: row.default_billing_mode,
    default_markup_pct: row.default_markup_pct, usd_to_brl: row.usd_to_brl } : null
}
export async function readTenantAiRecord(query: AdminMenuQuery, tenantId: string) {
  // client_key_allowed / is_demo read through to_jsonb so this works whether or not those columns exist (absent = false).
  const row = unique((await query(`SELECT s.tenant_id IS NOT NULL AS has_settings,s.billing_mode,s.openrouter_api_key,s.markup_pct,s.last_key_error,s.last_key_error_at,
    (to_jsonb(s)->>'client_key_allowed')='true' AS client_key_allowed,(to_jsonb(t)->>'is_demo')='true' AS is_demo
    FROM public.tenants t LEFT JOIN public.tenant_ai_settings s ON s.tenant_id=t.id WHERE t.id=$1 LIMIT 2`, [tenantId])).rows)
  if (row && row.has_settings !== true) return row.is_demo === true ? { billing_mode: null, openrouter_api_key: null, markup_pct: null,
    client_key_allowed: false, is_demo: true, last_key_error: null, last_key_error_at: null } : null
  return row ? { billing_mode: row.billing_mode as AiBillingMode | null, openrouter_api_key: text(row.openrouter_api_key), markup_pct: row.markup_pct,
    client_key_allowed: row.client_key_allowed === true, is_demo: row.is_demo === true,
    last_key_error: text(row.last_key_error), last_key_error_at: row.last_key_error_at instanceof Date ? row.last_key_error_at.toISOString() : text(row.last_key_error_at) } : null
}
export async function recordTenantAiKeyError(query: AdminMenuQuery, tenantId: string, message: string, occurredAt: string) {
  await query(`UPDATE public.tenant_ai_settings SET last_key_error=$2,last_key_error_at=$3 WHERE tenant_id=$1`, [tenantId, message, occurredAt])
}
export interface AiUsageRecord {
  tenant_id: string | null; feature: AiFeature; model: string | null; key_source: 'tenant' | 'platform'; billable: boolean
  cost_usd: number; markup_pct: number; charge_usd: number; generation_id: string | null; request_id: string | null
}
/** Fixed cost ledger columns only. Invoice/batch/settlement fields are untouched. */
export async function insertAiUsageRecord(query: AdminMenuQuery, row: AiUsageRecord) {
  await query(`INSERT INTO public.ai_usage_events(tenant_id,feature,model,key_source,billable,cost_usd,markup_pct,charge_usd,generation_id,request_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [row.tenant_id,row.feature,row.model,row.key_source,row.billable,row.cost_usd,row.markup_pct,row.charge_usd,row.generation_id,row.request_id])
}
