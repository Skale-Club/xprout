import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ missingOptional: false, failOptional: false, publishedAt: '2026-01-01T00:00:00Z' as string | null, selections: [] as string[] }))
const tenantId = '11111111-1111-4111-8111-111111111111', brandId = '22222222-2222-4222-8222-222222222222'
vi.mock('@/lib/data/owned-mode', () => ({ ownedModeActive: () => false }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ host: 'partner.example.org' }) }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => ({ from: (table: string) => {
  let projection = ''
  const resolve = async () => {
    state.selections.push(`${table}:${projection}`)
    const optional = ['subdomain', 'business_kind', 'google_site_verification,bing_site_verification', 'apex_tenant_id,apex_home_slug,tenant_marketing_routes'].includes(projection)
    if (optional && state.failOptional) return { data: null, error: { code: '42501' } }
    if (optional && state.missingOptional) return { data: null, error: { code: '42703' } }
    if (table === 'brands') return { data: projection.startsWith('apex_')
      ? { apex_tenant_id: '11111111-1111-4111-8111-111111111111', apex_home_slug: 'home', tenant_marketing_routes: true }
      : { id: '22222222-2222-4222-8222-222222222222', name: 'Partner', primary_host: 'partner.example.org', extra_hosts: [], default_lang: 'en' }, error: null }
    if (table === 'tenant_settings') return { data: { google_site_verification: 'google-token', bing_site_verification: 'bing-token' }, error: null }
    if (projection === 'brand_id,is_demo,published_at') return { data: { brand_id: '22222222-2222-4222-8222-222222222222', is_demo: false, published_at: state.publishedAt }, error: null }
    if (projection === 'subdomain') return { data: { subdomain: 'company' }, error: null }
    if (projection === 'business_kind') return { data: { business_kind: 'software' }, error: null }
    return { data: { id: '11111111-1111-4111-8111-111111111111', slug: 'company', name: 'Partner Company', is_active: true,
      created_at: '2020-01-01T00:00:00Z', custom_domain: null, custom_domain_verified: false, tenant_settings: { language: 'es', seo_noindex: false } }, error: null }
  }
  type Builder = { select: (columns: string) => Builder; eq: () => Builder; single: typeof resolve; maybeSingle: typeof resolve }
  const builder: Builder = { select: (columns: string) => { projection = columns; return builder }, eq: () => builder, single: resolve, maybeSingle: resolve }
  return builder
} }) }))
import { loadSiteBrand, loadSiteIdentity, loadTenantSite, tenantSiteMetadata } from '@/lib/site/runtime'

beforeEach(() => { state.missingOptional = false; state.failOptional = false; state.publishedAt = '2026-01-01T00:00:00Z'; state.selections = [] })

describe('legacy optional site schema preserves authority', () => {
  it('retains assigned apex settings, business kind and verification for canonical tenant metadata', async () => {
    expect(await loadSiteBrand(brandId)).toMatchObject({ apex_tenant_id: tenantId, tenant_marketing_routes: true })
    const identity = await loadSiteIdentity('company')
    expect(identity?.tenant).toMatchObject({ subdomain: 'company', business_kind: 'software', tenant_settings: { google_site_verification: 'google-token' } })
    expect(await loadTenantSite('company', '/company/about')).toMatchObject({ baseUrl: 'https://partner.example.org', canonicalUrl: 'https://partner.example.org/about' })
    expect(await tenantSiteMetadata('company', '/company')).toMatchObject({ verification: { google: 'google-token', other: { 'msvalidate.01': 'bing-token' } } })
  })
  it('does not republish an explicit draft when newer optional columns are absent', async () => {
    state.missingOptional = true; state.publishedAt = null
    const identity = await loadSiteIdentity('company')
    expect(identity?.tenant.published_at).toBeNull()
    expect(identity?.tenant.subdomain).toBeNull()
    expect(identity?.brand).not.toHaveProperty('apex_tenant_id')
    expect(state.selections).toContain('tenants:brand_id,is_demo,published_at')
  })
  it('propagates optional-field permission/database failures rather than pretending the schema is old', async () => {
    state.failOptional = true
    await expect(loadSiteIdentity('company')).rejects.toThrow('unavailable')
  })
})
