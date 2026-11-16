import type { TenantSettings, Tenant, UserRole, StripeConnection } from '@/types/database'
import { AdminMenuError, type AdminMenuQuery } from './admin-menus'
import { planCeiling, resolveTenantCapabilities, type ServiceSettings } from '../service-modes'
import { SERVICE_SETTINGS_KEYS, validateServiceSettingsPatch } from '../service-settings'
import { ACTION_LINK_COLUMNS, normalizeActionUrl } from '../menu-action-links'
import { TAX_PROMO_READY_SQL, TAX_RATE_BPS_MAX } from '../orders/tax-promo'
import { SCHEDULING_READY_SQL } from '../orders/scheduled-orders'

export type AdminStoreContext = { tenantId: string; role: UserRole }
export class LockedServiceSettingsError extends AdminMenuError {
  constructor(public locked: string[]) { super(403, 'Not included in your plan') }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const STORE_COLUMNS = [
  'currency', 'language', 'address', 'phone', 'city', 'region', 'postal_code', 'country',
  'latitude', 'longitude', 'price_range', 'tip_percentage_1', 'tip_percentage_2', 'tip_percentage_3', 'business_hours',
  ...SERVICE_SETTINGS_KEYS,
].join(', ')
const STORE_COLUMNS_WITH_LINKS = `${STORE_COLUMNS}, ${ACTION_LINK_COLUMNS.join(', ')}`

/** Whether the menu action link columns exist yet (docs/owned-schema/20261116120000_menu_action_links.sql). */
export async function actionLinkColumnsReady(query: AdminMenuQuery): Promise<boolean> {
  const { rows } = await query(`SELECT count(*) = ${ACTION_LINK_COLUMNS.length} AS ready FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tenant_settings' AND column_name = ANY($1::text[])`, [ACTION_LINK_COLUMNS])
  return rows[0]?.ready === true
}

/** Whether the tax and promo schema step ran (docs/owned-schema/20261116130000_tax_and_promo_codes.sql). */
export async function taxPromoSchemaReady(query: AdminMenuQuery): Promise<boolean> {
  return (await query(TAX_PROMO_READY_SQL)).rows[0]?.ready === true
}
/** Whether the scheduled-orders schema step ran (docs/owned-schema/20261116140000_scheduled_orders.sql). */
export async function schedulingSchemaReady(query: AdminMenuQuery): Promise<boolean> {
  return (await query(SCHEDULING_READY_SQL)).rows[0]?.ready === true
}
const storeColumns = (linksReady: boolean, taxReady: boolean, schedulingReady = false) =>
  `${linksReady ? STORE_COLUMNS_WITH_LINKS : STORE_COLUMNS}${taxReady ? ', tax_rate_bps' : ''}${schedulingReady ? ', scheduled_orders_enabled' : ''}`

function assertContext(context: AdminStoreContext, write = false) {
  if (!UUID.test(context.tenantId) || !['superadmin', 'store-admin', 'store-staff'].includes(context.role)) throw new AdminMenuError(403, 'Forbidden')
  if (write && context.role === 'store-staff') throw new AdminMenuError(403, 'Forbidden')
}

function parseFeatures(value: unknown): string[] | null {
  if (value === null || value === undefined) return null
  if (!Array.isArray(value) || value.some(feature => typeof feature !== 'string')) throw new AdminMenuError(503, 'Plan information is unavailable')
  return value
}

async function loadPlan(query: AdminMenuQuery, tenantId: string, lock = false) {
  const result = await query(`SELECT s.status, p.features FROM public.tenant_subscriptions s
    JOIN public.plans p ON p.id=s.plan_id WHERE s.tenant_id=$1 LIMIT 2${lock ? ' FOR SHARE OF s,p' : ''}`, [tenantId])
  if (result.rows.length > 1) throw new AdminMenuError(503, 'Plan information is unavailable')
  const row = result.rows[0]
  if (!row || !['active', 'trial'].includes(String(row.status))) return null
  return parseFeatures(row.features)
}

export async function readAdminStorePage(query: AdminMenuQuery, context: AdminStoreContext) {
  assertContext(context)
  const linksReady = await actionLinkColumnsReady(query)
  const taxReady = await taxPromoSchemaReady(query)
  const schedulingReady = await schedulingSchemaReady(query)
  const [settingsResult, tenantResult, stripeResult, features] = await Promise.all([
    query(`SELECT ${storeColumns(linksReady, taxReady, schedulingReady)} FROM public.tenant_settings WHERE tenant_id=$1 LIMIT 1`, [context.tenantId]),
    query('SELECT custom_domain,custom_domain_verified FROM public.tenants WHERE id=$1 LIMIT 1', [context.tenantId]),
    query(`SELECT id,tenant_id,stripe_account_id,scope,connected_at,is_active,disconnected_at,created_at,updated_at
      FROM public.stripe_connections WHERE tenant_id=$1 AND is_active=true ORDER BY connected_at DESC LIMIT 2`, [context.tenantId]),
    loadPlan(query, context.tenantId),
  ])
  const tenant = tenantResult.rows[0]
  if (!tenant) throw new AdminMenuError(404, 'Tenant not found')
  if (stripeResult.rows.length > 1) throw new AdminMenuError(503, 'Store connection information is unavailable')
  const settings = (settingsResult.rows[0] ?? null) as unknown as TenantSettings | null
  return {
    settings,
    tenant: { custom_domain: tenant.custom_domain ?? null, custom_domain_verified: tenant.custom_domain_verified === true } as Pick<Tenant, 'custom_domain' | 'custom_domain_verified'>,
    stripeConnection: (stripeResult.rows[0] ?? null) as unknown as StripeConnection | null,
    capabilities: resolveTenantCapabilities(features, settings as ServiceSettings | null),
  }
}

const REGIONAL_COLUMNS = [
  'currency', 'language', 'address', 'phone', 'city', 'region', 'postal_code', 'country', 'latitude', 'longitude',
  'price_range', 'tip_percentage_1', 'tip_percentage_2', 'tip_percentage_3', 'business_hours',
] as const

function validateRegionalPatch(input: unknown, payments: boolean, current: Record<string, unknown> | null, linksReady = true, tax: { ready: boolean; guestOrdering: boolean } = { ready: true, guestOrdering: true }, scheduling: { ready: boolean; guestOrdering: boolean } = { ready: true, guestOrdering: true }) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AdminMenuError(400, 'Invalid settings')
  const body = input as Record<string, unknown>
  const allowed = new Set<string>([...REGIONAL_COLUMNS, ...ACTION_LINK_COLUMNS, 'tax_rate_bps', 'scheduled_orders_enabled'])
  if (Object.keys(body).length === 0 || Object.keys(body).some(key => !allowed.has(key))) throw new AdminMenuError(400, 'Invalid settings')
  const patch: Record<string, unknown> = {}
  // Menu links and the "Powered by" switch: https URLs or empty, and a boolean.
  if ('hide_platform_brand' in body && typeof body.hide_platform_brand !== 'boolean') throw new AdminMenuError(400, 'Invalid hide_platform_brand')
  for (const key of ['order_online_url', 'reservation_url'] as const) {
    if (!(key in body)) continue
    const link = normalizeActionUrl(body[key])
    if (!link.ok) throw new AdminMenuError(400, `${key === 'order_online_url' ? 'Order online' : 'Reservation'} link must be a valid https:// address of at most 500 characters`)
    patch[key] = link.value
  }
  if ('hide_platform_brand' in body) patch.hide_platform_brand = body.hide_platform_brand
  // The schema step may not have run yet: an untouched default is ignored, a real change is refused.
  if (!linksReady) {
    for (const key of ACTION_LINK_COLUMNS) {
      if (!(key in patch)) continue
      if (patch[key] !== null && patch[key] !== false) throw new AdminMenuError(503, 'Menu links are not available yet')
      delete patch[key]
    }
  }
  // Sales tax: one rate per restaurant in basis points (0-2500), part of guest ordering.
  if ('tax_rate_bps' in body) {
    const bps = body.tax_rate_bps
    if (typeof bps !== 'number' || !Number.isInteger(bps) || bps < 0 || bps > TAX_RATE_BPS_MAX) throw new AdminMenuError(400, 'Sales tax must be between 0% and 25%')
    if (!tax.ready) {
      // The schema step may not have run yet: an untouched 0 is ignored, a real rate is refused.
      if (bps !== 0) throw new AdminMenuError(503, 'Sales tax is not available yet')
    } else {
      if (bps !== Number(current?.tax_rate_bps ?? 0) && !tax.guestOrdering) throw new AdminMenuError(403, 'Sales tax is part of ordering from the menu')
      patch.tax_rate_bps = bps
    }
  }
  // Scheduled orders: a restaurant switch, part of guest ordering.
  if ('scheduled_orders_enabled' in body) {
    const enabled = body.scheduled_orders_enabled
    if (typeof enabled !== 'boolean') throw new AdminMenuError(400, 'Invalid scheduled_orders_enabled')
    if (!scheduling.ready) {
      // The schema step may not have run yet: an untouched false is ignored, switching it on is refused.
      if (enabled) throw new AdminMenuError(503, 'Scheduled orders are not available yet')
    } else {
      if (enabled !== (current?.scheduled_orders_enabled === true) && !scheduling.guestOrdering) throw new AdminMenuError(403, 'Scheduled orders are part of ordering from the menu')
      patch.scheduled_orders_enabled = enabled
    }
  }
  for (const key of REGIONAL_COLUMNS) {
    if (!(key in body)) continue
    const value = body[key]
    if (['latitude', 'longitude'].includes(key)) {
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) throw new AdminMenuError(400, `Invalid ${key}`)
      patch[key] = value
      continue
    }
    if (key === 'business_hours') {
      if (value !== null && (!value || typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(item => typeof item !== 'string'))) throw new AdminMenuError(400, 'Invalid business hours')
      patch[key] = value
      continue
    }
    if (key.startsWith('tip_percentage_')) {
      if (!payments) {
        if (current?.[key] !== value) throw new AdminMenuError(403, 'Tip presets are part of the Menu + Payments plan')
      }
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 100) throw new AdminMenuError(400, `Invalid ${key}`)
      patch[key] = value
      continue
    }
    if (['currency', 'language'].includes(key) ? typeof value !== 'string' : value !== null && typeof value !== 'string') throw new AdminMenuError(400, `Invalid ${key}`)
    if (['city', 'region', 'postal_code', 'country', 'price_range'].includes(key)) {
      patch[key] = typeof value === 'string' ? value.trim() || null : null
    } else if (key === 'currency') {
      if (typeof value !== 'string') throw new AdminMenuError(400, 'Invalid currency')
      patch[key] = value.trim().toUpperCase()
    } else {
      patch[key] = value
    }
  }
  return patch
}

export async function mutateAdminStoreSettings(query: AdminMenuQuery, context: AdminStoreContext, input: unknown) {
  assertContext(context, true)
  await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`xmartmenu-store-settings:${context.tenantId}`])
  const features = await loadPlan(query, context.tenantId, true)
  const linksReady = await actionLinkColumnsReady(query)
  const taxReady = await taxPromoSchemaReady(query)
  const schedulingReady = await schedulingSchemaReady(query)
  const columns = storeColumns(linksReady, taxReady, schedulingReady)
  const currentResult = await query(`SELECT ${columns} FROM public.tenant_settings WHERE tenant_id=$1 LIMIT 1 FOR UPDATE`, [context.tenantId])
  const current = currentResult.rows[0] ?? null
  const patch = validateRegionalPatch(input, planCeiling(features).payments, current, linksReady,
    { ready: taxReady, guestOrdering: resolveTenantCapabilities(features, current as ServiceSettings | null).guestOrdering },
    { ready: schedulingReady, guestOrdering: resolveTenantCapabilities(features, current as ServiceSettings | null).guestOrdering })
  const fields = Object.keys(patch)
  if (!fields.length) return { settings: current as unknown as TenantSettings, capabilities: resolveTenantCapabilities(features, current as ServiceSettings | null) }
  const result = await query(`INSERT INTO public.tenant_settings AS s (tenant_id,${fields.join(',')},updated_at)
    VALUES ($1,${fields.map((_, index) => `$${index + 2}`).join(',')},now())
    ON CONFLICT (tenant_id) DO UPDATE SET ${fields.map(field => `${field}=EXCLUDED.${field}`).join(',')},updated_at=now()
    RETURNING ${columns}`, [context.tenantId, ...fields.map(field => patch[field])])
  if (!result.rows[0]) throw new AdminMenuError(503, 'Settings could not be saved')
  const settings = result.rows[0] as unknown as TenantSettings
  return { settings, capabilities: resolveTenantCapabilities(features, settings as ServiceSettings) }
}

export async function mutateAdminServiceSettings(query: AdminMenuQuery, context: AdminStoreContext, input: unknown) {
  assertContext(context, true)
  await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`xmartmenu-service-settings:${context.tenantId}`])
  const features = await loadPlan(query, context.tenantId, true)
  const currentResult = await query(`SELECT tenant_id,${SERVICE_SETTINGS_KEYS.join(',')} FROM public.tenant_settings WHERE tenant_id=$1 LIMIT 1 FOR UPDATE`, [context.tenantId])
  const current = currentResult.rows[0] ?? null
  const capabilities = resolveTenantCapabilities(features, current as ServiceSettings | null)
  const { patch, locked, errors } = validateServiceSettingsPatch(input, capabilities, current)
  if (errors.length) throw new AdminMenuError(400, errors[0]!)
  if (locked.length) throw new LockedServiceSettingsError(locked)
  const fields = Object.keys(patch)
  if (!fields.length) throw new AdminMenuError(400, 'Invalid settings')
  const result = await query(`INSERT INTO public.tenant_settings AS s (tenant_id,${fields.join(',')},updated_at)
    VALUES ($1,${fields.map((_, index) => `$${index + 2}`).join(',')},now())
    ON CONFLICT (tenant_id) DO UPDATE SET ${fields.map(field => `${field}=EXCLUDED.${field}`).join(',')},updated_at=now()
    RETURNING ${SERVICE_SETTINGS_KEYS.join(',')}`, [context.tenantId, ...fields.map(field => patch[field as keyof typeof patch])])
  if (!result.rows[0]) throw new AdminMenuError(503, 'Settings could not be saved')
  const settings = result.rows[0] as ServiceSettings
  return { settings, capabilities: resolveTenantCapabilities(features, settings) }
}

export async function mutateAdminCustomDomain(query: AdminMenuQuery, context: AdminStoreContext, tenantId: string, value: unknown) {
  assertContext(context, true)
  if (tenantId !== context.tenantId) throw new AdminMenuError(403, 'Forbidden')
  if (typeof value !== 'string') throw new AdminMenuError(400, 'Invalid custom domain')
  const domain = value.trim().toLowerCase() || null
  try {
    const result = await query(`UPDATE public.tenants SET custom_domain=$1,custom_domain_verified=false,updated_at=now()
      WHERE id=$2 RETURNING custom_domain,custom_domain_verified`, [domain, context.tenantId])
    if (!result.rows[0]) throw new AdminMenuError(404, 'Tenant not found')
    return result.rows[0]
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') throw new AdminMenuError(409, 'This custom domain is already in use')
    throw error
  }
}

export async function markAdminCustomDomainVerified(query: AdminMenuQuery, context: AdminStoreContext, tenantId: string, domain: string, verified: boolean) {
  assertContext(context, true)
  if (tenantId !== context.tenantId || context.role === 'store-staff') throw new AdminMenuError(403, 'Forbidden')
  const result = await query(`UPDATE public.tenants SET custom_domain=$1,custom_domain_verified=$2,updated_at=now()
    WHERE id=$3 RETURNING custom_domain,custom_domain_verified`, [domain, verified, context.tenantId])
  if (!result.rows[0]) throw new AdminMenuError(404, 'Tenant not found')
  return result.rows[0]
}
