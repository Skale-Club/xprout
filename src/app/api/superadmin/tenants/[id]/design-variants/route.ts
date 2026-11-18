/**
 * Superadmin › client › design variants (docs/product/design-variants.md).
 * GET  → { slots, stored, resolved, ready }
 * PUT  { variants } → full replace of the client's variant map, validated against the registry.
 * Superadmin only: the restaurant's own settings API never accepts this field. The public
 * menu cache of the client is dropped by withApi after a successful write (menu-cache-hooks.ts).
 */
import { NextResponse } from 'next/server'
import { assertSuperadmin } from '@/lib/superadmin-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { withApi } from '@/lib/observability/with-api'
import { log } from '@/lib/observability/log'
import { AdminMenuError, adminMenusOwned, type AdminMenuQuery } from '@/lib/data/admin-menus'
import { authorizeAdminActor } from '@/lib/data/admin-actor'
import { ownedAdminTransaction } from '@/lib/data/admin-menus-runtime'
import { DESIGN_SLOTS, DESIGN_VARIANTS_READY_SQL, parseDesignVariants, resolveDesignVariants, type DesignVariants } from '@/lib/design-variants'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const NOT_READY = 'Design variants need the schema step (docs/owned-schema/20261118100000_tenant_design_variants.sql) first'

function payload(stored: unknown, ready: boolean) {
  const map = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}
  return { slots: DESIGN_SLOTS, stored: map, resolved: resolveDesignVariants(map), ready }
}

function failure(error: unknown) {
  if (error instanceof AdminMenuError) return NextResponse.json({ error: error.message }, { status: error.status })
  log.error('superadmin.design_variants_error', { err: error })
  return NextResponse.json({ error: 'Design variants are unavailable' }, { status: 503 })
}

async function ownedRead(query: AdminMenuQuery, tenantId: string) {
  const ready = (await query(DESIGN_VARIANTS_READY_SQL)).rows[0]?.ready === true
  if (!ready) return payload({}, false)
  const { rows } = await query('SELECT design_variants FROM public.tenant_settings WHERE tenant_id=$1', [tenantId])
  if (rows.length !== 1) throw new AdminMenuError(404, 'Client not found')
  return payload(rows[0].design_variants, true)
}

async function handleGET(_request: Request, { params }: Ctx) {
  const authorization = await assertSuperadmin()
  if (!authorization) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Invalid client id' }, { status: 400 })
  try {
    if (adminMenusOwned()) {
      return NextResponse.json(await ownedAdminTransaction(false, async query => {
        await authorizeAdminActor(query, { actorId: authorization.principal.userId, role: 'superadmin', tenantId: id })
        return ownedRead(query, id)
      }))
    }
    // Legacy path: select('*') returns the column only once it exists.
    const { data, error } = await createServiceClient().from('tenant_settings').select('*').eq('tenant_id', id).maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    return NextResponse.json(payload(data.design_variants, 'design_variants' in data))
  } catch (error) { return failure(error) }
}

async function handlePUT(request: Request, { params }: Ctx) {
  const authorization = await assertSuperadmin()
  if (!authorization) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Invalid client id' }, { status: 400 })
  const body = (await request.json().catch(() => null)) as { variants?: unknown } | null
  const parsed = parseDesignVariants(body?.variants)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const value: DesignVariants = parsed.value
  try {
    if (adminMenusOwned()) {
      return NextResponse.json(await ownedAdminTransaction(true, async query => {
        await authorizeAdminActor(query, { actorId: authorization.principal.userId, role: 'superadmin', tenantId: id }, true)
        if ((await query(DESIGN_VARIANTS_READY_SQL)).rows[0]?.ready !== true) throw new AdminMenuError(409, NOT_READY)
        const { rows } = await query('UPDATE public.tenant_settings SET design_variants=$2::jsonb WHERE tenant_id=$1 RETURNING design_variants', [id, JSON.stringify(value)])
        if (rows.length !== 1) throw new AdminMenuError(404, 'Client not found')
        return payload(rows[0].design_variants, true)
      }))
    }
    const service = createServiceClient()
    const { data: current, error: readError } = await service.from('tenant_settings').select('*').eq('tenant_id', id).maybeSingle()
    if (readError) throw readError
    if (!current) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    if (!('design_variants' in current)) return NextResponse.json({ error: NOT_READY }, { status: 409 })
    const { data, error } = await service.from('tenant_settings').update({ design_variants: value }).eq('tenant_id', id).select('design_variants').maybeSingle()
    if (error) throw error
    return NextResponse.json(payload(data?.design_variants ?? value, true))
  } catch (error) { return failure(error) }
}

export const GET = withApi('GET /api/superadmin/tenants/[id]/design-variants', handleGET)
export const PUT = withApi('PUT /api/superadmin/tenants/[id]/design-variants', handlePUT)
