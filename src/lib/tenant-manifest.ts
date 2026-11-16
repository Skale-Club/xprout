import type { MetadataRoute } from 'next'
import { BRAND_BASE, BRAND_PRIMARY } from '@/lib/brand'
import { tenantMonogramIcon } from '@/lib/tenant-metadata'

export interface TenantManifestInput {
  slug: string
  name: string
  logoUrl?: string | null
  primaryColor?: string | null
  customDomain?: string | null
  customDomainVerified?: boolean | null
}

function hostOnly(host: string | null | undefined): string {
  return (host ?? '').split(':')[0].trim().toLowerCase()
}

/** True when the request host is the tenant's verified custom domain (the menu is then served at "/"). */
export function isTenantCustomDomainHost(
  host: string | null | undefined,
  tenant: Pick<TenantManifestInput, 'customDomain' | 'customDomainVerified'>,
): boolean {
  const domain = hostOnly(tenant.customDomain)
  return Boolean(domain && tenant.customDomainVerified && hostOnly(host) === domain)
}

function iconType(url: string): string | undefined {
  const path = url.split(/[?#]/u)[0].toLowerCase()
  if (url.startsWith('data:image/svg+xml') || path.endsWith('.svg')) return 'image/svg+xml'
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.webp')) return 'image/webp'
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg'
  return undefined
}

/** Per-restaurant web app manifest: installing a menu installs the restaurant, not the platform. */
export function buildTenantManifest(tenant: TenantManifestInput, host?: string | null): MetadataRoute.Manifest {
  const root = isTenantCustomDomainHost(host, tenant) ? '/' : `/${tenant.slug}`
  const color = /^#[0-9a-f]{3,8}$/iu.test(tenant.primaryColor?.trim() ?? '') ? tenant.primaryColor!.trim() : BRAND_PRIMARY
  const src = tenant.logoUrl?.trim() || tenantMonogramIcon(tenant.name)
  const type = iconType(src)
  return {
    name: tenant.name,
    short_name: tenant.name.length > 12 ? tenant.name.slice(0, 12).trim() : tenant.name,
    start_url: root,
    scope: root,
    display: 'standalone',
    background_color: BRAND_BASE,
    theme_color: color,
    icons: [{ src, sizes: 'any', ...(type ? { type } : {}), purpose: 'any' }],
  }
}
