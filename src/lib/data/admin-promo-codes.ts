import type { PromoCodeInput } from '../orders/promo-admin'
import { TAX_PROMO_READY_SQL } from '../orders/tax-promo'
import { AdminMenuError, type AdminMenuQuery } from './admin-menus'
import type { AdminStoreContext } from './admin-store-settings'

export type AdminPromoCode = {
  id: string; code: string; kind: 'percent' | 'fixed'; value: number
  starts_at: string | null; ends_at: string | null; is_active: boolean; created_at: string
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const COLUMNS = 'id,code,kind,value,starts_at,ends_at,is_active,created_at'

function assertContext(context: AdminStoreContext, write = false) {
  if (!UUID.test(context.tenantId) || !['superadmin', 'store-admin', 'store-staff'].includes(context.role)) throw new AdminMenuError(403, 'Forbidden')
  if (write && context.role === 'store-staff') throw new AdminMenuError(403, 'Forbidden')
}
async function schemaReady(query: AdminMenuQuery) {
  return (await query(TAX_PROMO_READY_SQL)).rows[0]?.ready === true
}
async function assertReady(query: AdminMenuQuery) {
  if (!(await schemaReady(query))) throw new AdminMenuError(503, 'Promo codes are not available yet')
}

/** Newest first; empty (not an error) until the schema step has run. */
export async function listAdminPromoCodes(query: AdminMenuQuery, context: AdminStoreContext): Promise<{ ready: boolean; codes: AdminPromoCode[] }> {
  assertContext(context)
  if (!(await schemaReady(query))) return { ready: false, codes: [] }
  const result = await query(`SELECT ${COLUMNS} FROM public.promo_codes WHERE tenant_id=$1 ORDER BY created_at DESC,id LIMIT 501`, [context.tenantId])
  return { ready: true, codes: result.rows.slice(0, 500) as unknown as AdminPromoCode[] }
}

export async function createAdminPromoCode(query: AdminMenuQuery, context: AdminStoreContext, input: PromoCodeInput): Promise<AdminPromoCode> {
  assertContext(context, true)
  await assertReady(query)
  const result = await query(`INSERT INTO public.promo_codes (tenant_id,code,kind,value,starts_at,ends_at) VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (tenant_id,code) DO NOTHING RETURNING ${COLUMNS}`,
  [context.tenantId, input.code, input.kind, input.value, input.starts_at, input.ends_at])
  if (!result.rows[0]) throw new AdminMenuError(409, 'You already have a promo code with this name')
  return result.rows[0] as unknown as AdminPromoCode
}

/** Codes are deactivated, never deleted: past orders keep the code text they used. */
export async function deactivateAdminPromoCode(query: AdminMenuQuery, context: AdminStoreContext, id: string): Promise<AdminPromoCode> {
  assertContext(context, true)
  if (!UUID.test(id)) throw new AdminMenuError(400, 'Invalid promo code')
  await assertReady(query)
  const result = await query(`UPDATE public.promo_codes SET is_active=false WHERE tenant_id=$1 AND id=$2 RETURNING ${COLUMNS}`, [context.tenantId, id])
  if (!result.rows[0]) throw new AdminMenuError(404, 'Promo code not found')
  return result.rows[0] as unknown as AdminPromoCode
}
