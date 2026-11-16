import { cache } from 'react'
import { headers } from 'next/headers'
import { ownedModeActive } from '@/lib/data/owned-mode'
import { readSeoTenant, readSiteBrand, type SeoTenant } from '@/lib/data/public-seo'
import { resolveSite, type SiteBrand, type SiteTenant } from './resolve-site'
import { siteLocale } from './request-contract'

const DEFAULT_BRAND_ID = '00000000-0000-4000-8000-000000000001'
// Restaurant subdomains are owned-only; old development schemas need not have the column.
export const LEGACY_SITE_COLUMNS = 'id,slug,name,is_active,created_at,updated_at,custom_domain,custom_domain_verified,tenant_settings(language,seo_noindex)'
type LegacyRow = Record<string, unknown>

/** Code-first compatibility: only the absence of a column gets the old publication state. */
export function legacySiteTenant(row: LegacyRow, lifecycle?: LegacyRow | null): SeoTenant {
  const settings = (Array.isArray(row.tenant_settings) ? row.tenant_settings[0] : row.tenant_settings) as SiteTenant['tenant_settings']
  return { id: String(row.id), slug: String(row.slug), name: String(row.name), is_active: row.is_active === true,
    custom_domain: typeof row.custom_domain === 'string' ? row.custom_domain : null,
    custom_domain_verified: row.custom_domain_verified === true,
    subdomain: typeof row.subdomain === 'string' ? row.subdomain : null,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
    is_demo: lifecycle?.is_demo === true,
    published_at: lifecycle ? (typeof lifecycle.published_at === 'string' ? lifecycle.published_at : null) : (typeof row.created_at === 'string' ? row.created_at : null),
    brand_id: typeof lifecycle?.brand_id === 'string' ? lifecycle.brand_id : null,
    ...(row.business_kind === 'software' || row.business_kind === 'agency' || row.business_kind === 'restaurant' ? { business_kind: row.business_kind } : {}),
    tenant_settings: settings ?? null }
}

export function missingSiteColumns(error: { code?: string } | null): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204'
}

export const loadSiteBrand = cache(async (brandId: string | null = null): Promise<SiteBrand | undefined> => {
  if (ownedModeActive()) {
    const { ownedAdminTransaction } = await import('@/lib/data/admin-menus-runtime')
    return ownedAdminTransaction(false, query => readSiteBrand(query, brandId))
  }
  const { createServiceClient } = await import('@/lib/supabase/server')
  const client = createServiceClient()
  const { data, error } = await client.from('brands')
    .select('id,name,primary_host,extra_hosts,logo,icon,social_image,gtm_id,support_email,privacy_url,terms_url,show_powered_by,default_lang')
    .eq('id', brandId ?? DEFAULT_BRAND_ID).maybeSingle()
  if (error) {
    if (!brandId && ['42P01', 'PGRST205'].includes(error.code)) return undefined
    throw new Error('Site brand is unavailable')
  }
  if (!data) throw new Error('Site brand is unavailable')
  const apex = await client.from('brands').select('apex_tenant_id,apex_home_slug,tenant_marketing_routes').eq('id', data.id).maybeSingle()
  if (apex.error && !missingSiteColumns(apex.error)) throw new Error('Site apex configuration is unavailable')
  return { ...data, ...(apex.error ? {} : apex.data) } as SiteBrand
})

export const loadSiteIdentity = cache(async (slug: string): Promise<{ tenant: SeoTenant; brand?: SiteBrand } | null> => {
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/i.test(slug)) return null
  if (ownedModeActive()) {
    const { ownedAdminTransaction } = await import('@/lib/data/admin-menus-runtime')
    return ownedAdminTransaction(false, async query => {
      const tenant = await readSeoTenant(query, slug)
      return tenant ? { tenant, brand: await readSiteBrand(query, tenant.brand_id) } : null
    })
  }
  const { createServiceClient } = await import('@/lib/supabase/server')
  const client = createServiceClient()
  const { data, error } = await client.from('tenants').select(LEGACY_SITE_COLUMNS).eq('slug', slug).maybeSingle()
  if (error) throw new Error('Site identity is unavailable')
  if (!data) return null
  const flags = await client.from('tenants').select('brand_id,is_demo,published_at').eq('id', data.id).single()
  if (flags.error && !missingSiteColumns(flags.error)) throw new Error('Site publication state is unavailable')
  // Optional later fields are read separately: their absence must never turn an
  // existing NULL published_at into the old created_at publication fallback.
  const optional = await Promise.all(['subdomain', 'business_kind'].map(async column => {
    const result = await client.from('tenants').select(column).eq('id', data.id).maybeSingle()
    if (result.error && !missingSiteColumns(result.error)) throw new Error('Site optional identity is unavailable')
    return result.error ? {} : result.data ?? {}
  }))
  const verification = await client.from('tenant_settings').select('google_site_verification,bing_site_verification').eq('tenant_id', data.id).maybeSingle()
  if (verification.error && !missingSiteColumns(verification.error)) throw new Error('Site verification is unavailable')
  const tenant = legacySiteTenant({ ...data, ...Object.assign({}, ...optional) }, flags.error ? null : flags.data)
  if (!verification.error && verification.data) tenant.tenant_settings = { ...tenant.tenant_settings, ...verification.data }
  return { tenant, brand: await loadSiteBrand(tenant.brand_id) }
})

/** Host stays outside the identity cache; aliases cannot reuse an indexable result. */
export async function loadTenantSite(slug: string, pathname: string, options: { privatePage?: boolean; preview?: boolean } = {}) {
  const identity = await loadSiteIdentity(slug)
  if (!identity) return null
  const host = (await headers()).get('host') ?? ''
  return resolveSite({ ...identity, host, pathname, ...options })
}

/** Metadata on every tenant surface, including blog and published website pages. */
export async function tenantSiteMetadata(slug: string, pathname: string, options: { privatePage?: boolean } = {}) {
  const site = await loadTenantSite(slug, pathname, options)
  if (!site) return { robots: { index: false, follow: false } }
  return {
    robots: { index: site.indexable, follow: site.indexable },
    openGraph: { locale: siteLocale(site.lang) },
    verification: {
      google: site.tenant?.tenant_settings?.google_site_verification ?? undefined,
      other: site.tenant?.tenant_settings?.bing_site_verification ? { 'msvalidate.01': site.tenant.tenant_settings.bing_site_verification } : undefined,
    },
  }
}
