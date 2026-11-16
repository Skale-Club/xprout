import { after } from 'next/server'
import { publishEffectsEnabled, runPublishEffects } from './publish-effects'

/** Call only after the mutation transaction resolves; the callback owns no transaction. */
export function scheduleTenantPublish(tenantId: string | null, paths: string[] = []) {
  if (!publishEffectsEnabled(process.env)) return
  try {
    after(async () => {
      try {
        const { ownedAdminTransaction } = await import('../data/admin-menus-runtime')
        const { readSeoTenant, readSiteBrand } = await import('../data/public-seo')
        const { resolveSite } = await import('./resolve-site')
        const { tenantOwnHost, PLATFORM_BASE } = await import('../seo')
        const identity = await ownedAdminTransaction(false, async query => {
          if (!tenantId) return { tenant: null, brand: await readSiteBrand(query) }
          const rows = (await query('SELECT slug FROM public.tenants WHERE id=$1 LIMIT 2', [tenantId])).rows
          const tenant = rows.length === 1 ? await readSeoTenant(query, String(rows[0].slug)) : null
          return tenant ? { tenant, brand: await readSiteBrand(query, tenant.brand_id) } : null
        })
        if (!identity) return
        const host = identity.tenant ? tenantOwnHost(identity.tenant) ?? identity.brand?.primary_host ?? new URL(PLATFORM_BASE).hostname
          : identity.brand?.primary_host ?? new URL(PLATFORM_BASE).hostname
        const site = resolveSite({ ...identity, host, pathname: identity.tenant ? `/${identity.tenant.slug}` : '/' })
        let catalogPaths: string[] = []
        if (identity.tenant && site.indexable) {
          const { loadTenantDiscoveryExtras } = await import('./discovery-extras')
          catalogPaths = (await loadTenantDiscoveryExtras(identity.tenant.id, site.baseUrl)).map(entry => entry.url.slice(site.baseUrl.length)).slice(0, 90)
        }
        const result = await runPublishEffects(site, [...paths, ...catalogPaths])
        if (result.indexnow === 'failed' || result.cloudflare === 'failed') console.warn('[seo] Optional publication notification failed; cache TTL remains the fallback')
      } catch { console.warn('[seo] Optional publication effects unavailable; cache TTL remains the fallback') }
    })
  } catch { /* No request lifecycle (CLI/test): never run an outbound fallback inline. */ }
}
