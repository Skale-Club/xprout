import { BRAND_BASE, BRAND_NAME, BRAND_PRIMARY } from '@/lib/brand'
import type { MetadataRoute } from 'next'
import { PLATFORM_BRAND_ASSETS } from '@/lib/platform-brand'
import { requestSite } from '@/lib/site/request-runtime'
import { getTenantBySlug } from '@/lib/menu/public-menu-data'
import { buildTenantManifest } from '@/lib/tenant-manifest'
import { tenantMonogramIcon } from '@/lib/tenant-metadata'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const site = await requestSite()
  if (site.tenant) {
    const tenant = await getTenantBySlug(site.tenant.slug)
    if (tenant) return buildTenantManifest({ slug: tenant.slug, name: tenant.name, logoUrl: tenant.tenant_settings?.logo_url,
      primaryColor: tenant.tenant_settings?.primary_color, basePath: new URL(site.baseUrl).pathname || '/' })
  }
  if (site.brand.name !== BRAND_NAME) return {
    name: site.brand.name, short_name: site.brand.name.slice(0, 12), lang: site.lang,
    start_url: '/', scope: '/', display: 'standalone', background_color: '#ffffff', theme_color: '#18181b',
    icons: [{ src: site.brand.icon || tenantMonogramIcon(site.brand.name), sizes: 'any', purpose: 'any' }],
  }
  return {
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: 'A digital menu platform built for restaurant service, QR code ordering, and menu operations.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: BRAND_BASE,
    theme_color: BRAND_PRIMARY,
    icons: [
      { src: PLATFORM_BRAND_ASSETS.icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: PLATFORM_BRAND_ASSETS.icon, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: PLATFORM_BRAND_ASSETS.maskable192, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: PLATFORM_BRAND_ASSETS.maskable512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
