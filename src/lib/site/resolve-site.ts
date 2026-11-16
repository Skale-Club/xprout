import { BRAND_NAME, BRAND_URL } from '../brand'
import { resolveCustomDomainRoute } from '../custom-domain-routing'
import { PLATFORM_BASE, tenantOwnHost } from '../seo'
import { subdomainBase as configuredSubdomainBase, tenantSubdomainHost } from '../tenant-subdomain'
import { indexability, type IndexabilityReason } from './indexability'

export interface SiteBrand {
  id: string
  name: string
  primary_host: string
  extra_hosts: string[]
  default_lang: string
  logo?: string | null
  icon?: string | null
  social_image?: string | null
  gtm_id?: string | null
  support_email?: string | null
  privacy_url?: string | null
  terms_url?: string | null
  show_powered_by?: boolean
}

export interface SiteTenant {
  slug: string
  name?: string
  is_active: boolean
  is_demo: boolean
  published_at: string | null
  custom_domain?: string | null
  custom_domain_verified?: boolean
  subdomain?: string | null
  brand_id?: string | null
  tenant_settings?: { language?: string | null; seo_noindex?: boolean | null } | null
}

export interface ResolveSiteInput {
  host: string
  pathname: string
  tenant: SiteTenant | null
  brand?: SiteBrand
  platformOrigin?: string
  subdomainBase?: string | null
  preview?: boolean
  privatePage?: boolean
  now?: number
}

export interface ResolvedSite {
  origin: string
  baseUrl: string
  canonicalUrl: string
  brand: SiteBrand
  tenant: SiteTenant | null
  kind: 'brand' | 'tenant-path' | 'tenant-subdomain' | 'tenant-domain'
  lang: string
  indexable: boolean
  reason: IndexabilityReason
}

/** Parse an HTTP Host authority, never a URL or a forwarded-host list. */
export function normalizeSiteHost(value: string): string | null {
  if (!value || value !== value.trim() || /[\s/@\\,#?]/u.test(value)) return null
  const match = /^([^:]+)(?::([0-9]{1,5}))?$/u.exec(value)
  if (!match || (match[2] !== undefined && (Number(match[2]) < 1 || Number(match[2]) > 65535))) return null
  const host = match[1].toLowerCase().replace(/\.$/u, '')
  if (host.length > 253 || !host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label))) return null
  return host
}

function safeOrigin(value: string): string | null {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') return null
    return normalizeSiteHost(url.host) ? url.origin : null
  } catch { return null }
}

const language = (value: string | null | undefined) => value && /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/iu.test(value) ? value : null
const previewHost = (host: string | null) => !host || host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/u.test(host)
  || host.endsWith('.vercel.app') || host.endsWith('.netlify.app')
  || host.split('.').some(label => /(?:^|-)(?:dev|stage|staging|preview|test|localhost)(?:-|$)/u.test(label))

/** Pure site identity; loading/authorizing the supplied tenant and brand belongs to the caller. */
export function resolveSite(input: ResolveSiteInput): ResolvedSite {
  const platformOrigin = safeOrigin(input.platformOrigin ?? PLATFORM_BASE) ?? BRAND_URL
  const defaultHost = new URL(platformOrigin).hostname
  const brand: SiteBrand = input.brand ?? {
    id: '00000000-0000-4000-8000-000000000001', name: BRAND_NAME, primary_host: defaultHost,
    extra_hosts: defaultHost === 'xprout.app' ? ['www.xprout.app'] : [], default_lang: 'en', show_powered_by: true,
  }
  const brandHost = normalizeSiteHost(brand.primary_host)
  const brandOrigin = brandHost
    ? brandHost === defaultHost ? platformOrigin : `https://${brandHost}`
    : platformOrigin
  const host = normalizeSiteHost(input.host)
  const tenant = input.tenant
  const path = input.pathname.startsWith('/') && !input.pathname.startsWith('//') && !input.pathname.includes('\\')
    ? input.pathname.split(/[?#]/u)[0] : '/'
  const validPath = path === input.pathname.split(/[?#]/u)[0]
  const slugValid = tenant ? /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(tenant.slug) : true
  const domain = tenant?.custom_domain_verified && tenant.custom_domain ? normalizeSiteHost(tenant.custom_domain) : null
  const rawSubdomainBase = input.subdomainBase === undefined ? configuredSubdomainBase() : input.subdomainBase
  const subdomainBase = rawSubdomainBase ? normalizeSiteHost(rawSubdomainBase) : null
  const subdomain = tenant ? tenantSubdomainHost(tenant.subdomain, subdomainBase) : null
  // Wrap the existing canonical precedence after validating untrusted persisted host values.
  const ownHost = tenant ? tenantOwnHost({ ...tenant, custom_domain: domain, custom_domain_verified: Boolean(domain) }, subdomainBase) : null
  const origin = ownHost ? `https://${ownHost}` : brandOrigin
  const baseUrl = tenant && slugValid && !ownHost ? `${origin}/${tenant.slug}` : origin
  let kind: ResolvedSite['kind'] = 'brand'
  let localPath = path
  let gatePath = path
  if (tenant) {
    kind = host && host === domain ? 'tenant-domain' : host && host === subdomain ? 'tenant-subdomain' : 'tenant-path'
    // Existing routing handles whole-segment namespacing and preserves global routes.
    const route = resolveCustomDomainRoute(path, tenant.slug)
    const namespaced = route.kind === 'rewrite' ? route.pathname : path
    gatePath = namespaced
    const prefix = `/${tenant.slug}`
    localPath = namespaced === prefix ? '/' : namespaced.startsWith(`${prefix}/`) ? namespaced.slice(prefix.length) : namespaced
  }
  const canonicalUrl = `${baseUrl}${localPath === '/' ? '' : localPath}`
  const canonicalHost = new URL(origin).hostname
  const tenantPathMatches = !tenant || ownHost !== null || path === `/${tenant.slug}` || path.startsWith(`/${tenant.slug}/`)
  const gate = indexability({
    canonicalHost: Boolean(host && host === canonicalHost && brandHost && validPath && slugValid && tenantPathMatches),
    preview: input.preview || previewHost(host), privatePage: input.privatePage,
    brandMatched: !tenant?.brand_id || tenant.brand_id === brand.id,
    pathname: gatePath, tenantSlug: tenant?.slug,
    isActive: tenant?.is_active, isDemo: tenant?.is_demo, publishedAt: tenant?.published_at,
    seoNoindex: tenant?.tenant_settings?.seo_noindex, now: input.now,
  })
  return { origin, baseUrl, canonicalUrl, brand, tenant, kind,
    lang: language(tenant?.tenant_settings?.language) ?? language(brand.default_lang) ?? 'en', ...gate }
}
