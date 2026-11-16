import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getEffectiveTenant } from '@/lib/get-effective-tenant'
import { getTenantCapabilities } from '@/lib/tenant-plan'
import { withApi } from '@/lib/observability/with-api'
import { log } from '@/lib/observability/log'
import { AdminMenuError, adminMenusOwned } from '@/lib/data/admin-menus'
import { hasSameOriginAdminMutation } from '@/lib/data/admin-display-settings'
import { ownedAdminTransaction } from '@/lib/data/admin-menus-runtime'
import { createAdminPromoCode, deactivateAdminPromoCode, listAdminPromoCodes, type AdminPromoCode } from '@/lib/data/admin-promo-codes'
import { parsePromoInput } from '@/lib/orders/promo-admin'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const COLUMNS = 'id, code, kind, value, starts_at, ends_at, is_active, created_at'

function failure(error: unknown) {
  if (error instanceof AdminMenuError && error.status < 500) return json({ error: error.message }, error.status)
  if (error instanceof SyntaxError) return json({ error: 'Invalid request body' }, 400)
  log.error('admin.promo_codes_error', { err: error })
  return json({ error: 'Promo code service is unavailable' }, 503)
}

/** Promo codes belong to ordering from the menu (the guest-ordering capability). */
async function authorize(request: Request, write: boolean) {
  if (write && !hasSameOriginAdminMutation(request)) return { response: json({ error: 'Origin mismatch' }, 403) }
  const effective = await getEffectiveTenant()
  if (!effective) return { response: json({ error: 'Unauthorized' }, 401) }
  if (write && effective.role === 'store-staff') return { response: json({ error: 'Forbidden' }, 403) }
  if (!(await getTenantCapabilities(effective.tenantId)).guestOrdering) return { response: json({ error: 'Promo codes are part of ordering from the menu' }, 403) }
  return { context: { tenantId: effective.tenantId, role: effective.role } }
}

async function handleGET(request: Request) {
  try {
    const { response, context } = await authorize(request, false)
    if (response) return response
    if (adminMenusOwned()) return json(await ownedAdminTransaction(false, query => listAdminPromoCodes(query, context!)))
    const { data, error } = await createServiceClient().from('promo_codes').select(COLUMNS).eq('tenant_id', context!.tenantId).order('created_at', { ascending: false }).limit(500)
    return json(error ? { ready: false, codes: [] } : { ready: true, codes: data ?? [] })
  } catch (error) { return failure(error) }
}

async function handlePOST(request: Request) {
  try {
    const { response, context } = await authorize(request, true)
    if (response) return response
    const parsed = parsePromoInput(await request.json())
    if (!parsed.ok) return json({ error: parsed.error }, 400)
    if (adminMenusOwned()) return json({ code: await ownedAdminTransaction(true, query => createAdminPromoCode(query, context!, parsed.value)) }, 201)
    const { data, error } = await createServiceClient().from('promo_codes').insert({ tenant_id: context!.tenantId, ...parsed.value }).select(COLUMNS).single()
    if (error?.code === '23505') return json({ error: 'You already have a promo code with this name' }, 409)
    if (error) throw error
    return json({ code: data as AdminPromoCode }, 201)
  } catch (error) { return failure(error) }
}

/** Body { id, is_active: false }: the only change allowed after creation. */
async function handlePATCH(request: Request) {
  try {
    const { response, context } = await authorize(request, true)
    if (response) return response
    const body = await request.json() as { id?: unknown; is_active?: unknown }
    if (typeof body?.id !== 'string' || body.is_active !== false) return json({ error: 'Invalid request' }, 400)
    const id = body.id
    if (adminMenusOwned()) return json({ code: await ownedAdminTransaction(true, query => deactivateAdminPromoCode(query, context!, id)) })
    const { data, error } = await createServiceClient().from('promo_codes').update({ is_active: false })
      .eq('id', id).eq('tenant_id', context!.tenantId).select(COLUMNS).maybeSingle()
    if (error) throw error
    if (!data) return json({ error: 'Promo code not found' }, 404)
    return json({ code: data as AdminPromoCode })
  } catch (error) { return failure(error) }
}

export const GET = withApi('GET /api/admin/promo-codes', handleGET)
export const POST = withApi('POST /api/admin/promo-codes', handlePOST)
export const PATCH = withApi('PATCH /api/admin/promo-codes', handlePATCH)
