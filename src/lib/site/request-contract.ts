import type { ResolvedSite } from './resolve-site'

/** Proxy overwrites these before forwarding; no client-supplied context survives. */
export const SITE_CONTEXT_HEADER = 'x-xprout-site-context'
export const SITE_PATH_HEADER = 'x-xprout-request-path'
export const INTERNAL_SITE_PATH = '/api/internal/resolve-site'
export const SITE_CONTEXT_LIMIT = 12_000
export interface RequestSite extends ResolvedSite {
  pathname: string
  rewrite: string | null
  privatePage: boolean
}

export function serializeRequestSite(site: RequestSite): string {
  const value = encodeURIComponent(JSON.stringify(site))
  if (value.length > SITE_CONTEXT_LIMIT) throw new Error('Site context exceeds its bounded header budget')
  return value
}

export function parseRequestSite(value: string | null): RequestSite | null {
  if (!value || value.length > SITE_CONTEXT_LIMIT) return null
  try {
    const site = JSON.parse(decodeURIComponent(value)) as RequestSite
    if (!site || typeof site.origin !== 'string' || typeof site.lang !== 'string' || typeof site.brand?.id !== 'string'
      || typeof site.indexable !== 'boolean' || typeof site.pathname !== 'string'
      || !['brand','tenant-path','tenant-domain','tenant-subdomain','brand-apex-tenant'].includes(site.kind)) return null
    return site
  } catch { return null }
}

/** Generic language tags become Open Graph's territory form only for supported defaults. */
export function siteLocale(lang: string): string {
  const defaults: Record<string, string> = { en: 'en_US', pt: 'pt_BR', es: 'es_ES', fr: 'fr_FR', de: 'de_DE', it: 'it_IT', ja: 'ja_JP', ko: 'ko_KR', zh: 'zh_CN' }
  return defaults[lang.toLowerCase()] ?? lang.replace(/-/g, '_')
}
