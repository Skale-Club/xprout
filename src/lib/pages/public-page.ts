import { cache } from 'react'
import type { Metadata } from 'next'
import { getTenantBySlug } from '@/lib/menu/public-menu-data'
import { loadPublicPages } from '@/lib/data/tenant-pages-runtime'
import type { PublicPage, PublicPageNavItem } from '@/lib/data/tenant-pages'
import type { ResolvedSite } from '@/lib/site/resolve-site'
import { siteRobots } from '@/lib/site/indexability'
import { getCanonicalUrl, isTenantNoindex, resolveOgImageOverride, resolveSeoDescription, resolveSeoTitle } from '@/lib/seo'

/* eslint-disable @typescript-eslint/no-explicit-any -- tenant rows come from the untyped public menu loader, as in the pages */
export interface PublicPageTarget { tenant: any; page: PublicPage; nav: PublicPageNavItem[] }

/**
 * The published page at /<slug>/<pageSlug>, or null. Runs after the menu and
 * branch lookup has found nothing (resolveSlugTarget); one read per request is
 * shared by generateMetadata and the page. A database failure throws: a 500 is
 * honest, a cached 404 for a page that exists is not.
 */
export const loadPublicPageTarget = cache(async (slug: string, pageSlug: string): Promise<PublicPageTarget | null> => {
  const tenant = await getTenantBySlug(slug)
  if (!tenant) return null
  const { page, nav } = await loadPublicPages(tenant, pageSlug)
  return page ? { tenant, page, nav } : null
})

/** Title, description, canonical and social cards of a page, built like the menu page's. */
export function pageMetadata(tenant: any, page: PublicPage, site?: ResolvedSite | null): Metadata {
  const settings = tenant.tenant_settings as any
  const title = resolveSeoTitle(tenant, settings, page.title)
  const description = page.description || resolveSeoDescription(tenant, settings, page.title)
  const canonicalUrl = site?.canonicalUrl ?? getCanonicalUrl(tenant, `/${page.slug}`)
  const ogOverride = resolveOgImageOverride(settings)
  return {
    title: { absolute: title },
    description,
    metadataBase: new URL(canonicalUrl),
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'website', title, description, url: canonicalUrl, siteName: tenant.name,
      ...(site ? { locale: site.lang.replace('-', '_') } : {}),
      ...(ogOverride ? { images: [{ url: ogOverride, alt: tenant.name }] } : {}),
    },
    twitter: { card: 'summary_large_image', title, description, ...(ogOverride ? { images: [ogOverride] } : {}) },
    ...(site !== undefined ? { robots: siteRobots(site ?? { indexable: false }) } : isTenantNoindex(settings) ? { robots: { index: false, follow: false } } : {}),
  }
}
