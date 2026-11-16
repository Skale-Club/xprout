import { ownedModeActive } from '../data/owned-mode'
import type { ResolvedSite } from './resolve-site'
import { llmsText, type LlmFacts } from './discovery-extras'
import { loadLocalNavigation } from '../menu/local-navigation'
import { loadPublicPageNav } from '../data/tenant-pages-runtime'

export async function siteLlmsText(site: ResolvedSite): Promise<string> {
  if (!site.indexable) return ''
  if (!site.tenant) return llmsText(site)
  let facts: LlmFacts = {}, tenantId = site.tenant.id
  if (ownedModeActive()) {
    const { ownedAdminTransaction } = await import('../data/admin-menus-runtime')
    const row = await ownedAdminTransaction(false, async query => (await query(`SELECT t.id,s.address,s.city,s.phone,s.business_hours
      FROM public.tenants t LEFT JOIN public.tenant_settings s ON s.tenant_id=t.id WHERE t.slug=$1 AND t.is_active=true LIMIT 2`, [site.tenant!.slug])).rows)
    if (row.length !== 1) return ''
    tenantId = String(row[0].id); facts = row[0] as LlmFacts
  } else {
    const { createServiceClient } = await import('../supabase/server')
    const { data, error } = await createServiceClient().from('tenants').select('id,tenant_settings(address,city,phone,business_hours)').eq('slug', site.tenant.slug).eq('is_active', true).maybeSingle()
    if (error) throw error
    if (!data) return ''
    tenantId = data.id
    facts = ((Array.isArray(data.tenant_settings) ? data.tenant_settings[0] : data.tenant_settings) as LlmFacts | null | undefined) ?? {}
  }
  if (!tenantId) return ''
  const [navigation, pages] = await Promise.all([loadLocalNavigation(tenantId, site.baseUrl), loadPublicPageNav({ id: tenantId, slug: site.tenant.slug })])
  return llmsText(site, facts, [...navigation, ...pages.map(page => ({ title: page.title, href: `${site.baseUrl}/${page.slug}` }))])
}

export function discoveryTextResponse(body: string): Response {
  return body ? new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=60', Vary: 'Host' } })
    : new Response('Not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store', Vary: 'Host' } })
}
