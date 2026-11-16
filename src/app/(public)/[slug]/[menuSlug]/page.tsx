import { siteLocale } from '@/lib/site/request-contract'
import { siteFooterBrand } from '@/lib/site/footer-brand'
import { BRAND_PRIMARY } from '@/lib/brand'
export const revalidate = 60

import { notFound, permanentRedirect } from 'next/navigation'
import { sanitizeTenantForClient } from '@/lib/tenant-public'
import MenuPage from '@/components/menu/MenuPage'
import TenantPageView from '@/components/pages/TenantPageView'
import { loadPublicPageTarget, pageMetadata } from '@/lib/pages/public-page'
import { loadPublicPageNav } from '@/lib/data/tenant-pages-runtime'
import { resolveSlugTarget } from '@/lib/pages/page-rules'
import ScanRecorder from '@/components/menu/ScanRecorder'
import PrivateMenuWrapper from '@/components/menu/PrivateMenuWrapper'
import type { Metadata } from 'next'
import { getPublicMenuBase, loadPublicMenuData, withMenuPrices } from '@/lib/menu/public-menu-data'
import { parseTableParam } from '@/lib/service-modes'
import { computePrimaryForeground, safeCssColor } from '@/lib/color-utils'
import JsonLdScript from '@/components/seo/JsonLdScript'
import { loadTenantSite } from '@/lib/site/runtime'
import { siteRobots } from '@/lib/site/indexability'
import { loadLocalNavigation } from '@/lib/menu/local-navigation'
import { branchTitle, branchDescription, branchDirectionsUrl, dishPath, isIndexableDish } from '@/lib/menu/dish-pages'
import type { Product } from '@/types/database'
import {
  getCanonicalUrl,
  buildLocalBusinessJsonLd,
  buildMenuJsonLd,
  buildBranchJsonLd,
  buildBreadcrumbJsonLd,
  buildSameAs,
  resolveSeoTitle,
  resolveSeoDescription,
  resolveSeoKeywords,
  resolveOgImageOverride,
} from '@/lib/seo'

interface Props {
  params: Promise<{ slug: string; menuSlug: string }>
  searchParams: Promise<{ lang?: string; view?: string; table?: string; dish?: string; preview?: string; feed_preview?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, menuSlug } = await params
  // Same cached read the page makes (deduplicated per request).
  const base = await getPublicMenuBase(slug, menuSlug)
  if (base.kind === 'not_found') {
    // Not a menu or a branch: it may be one of the restaurant's website pages.
    const target = await loadPublicPageTarget(slug, menuSlug)
    if (!target || resolveSlugTarget(base.kind, true) !== 'page') return { title: 'Menu', robots: { index: false, follow: false } }
    const site = await loadTenantSite(slug, `/${slug}/${menuSlug}`)
    return { ...pageMetadata(target.tenant, target.page, site), robots: siteRobots(site ?? { indexable: false }) }
  }
  const tenant = base.tenant
  const site = await loadTenantSite(slug, `/${slug}/${menuSlug}`, { privatePage: base.kind === 'menu' && base.menu?.is_private === true })

  const sectionName = (base.kind === 'menu' ? base.location?.name ?? base.menu?.name : null) ?? 'Menu'
  const settings = tenant.tenant_settings as any
  const branch = base.kind === 'menu' ? base.location : null
  const title = branch ? branchTitle(tenant.name, branch) : resolveSeoTitle(tenant, settings, sectionName)
  const description = branch ? branchDescription(tenant.name, branch) : resolveSeoDescription(tenant, settings, `View the ${sectionName} menu`)
  const keywords = resolveSeoKeywords(settings)
  const canonicalPath = `/${menuSlug}`
  const canonicalUrl = site?.canonicalUrl ?? getCanonicalUrl(tenant, canonicalPath)
  const ogOverride = resolveOgImageOverride(settings)

  return {
    title: { absolute: title },
    description,
    metadataBase: new URL(canonicalUrl),
    ...(keywords.length ? { keywords } : {}),
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'website',
      title,
      description,
      url: canonicalUrl,
      siteName: tenant.name,
      ...(site ? { locale: siteLocale(site.lang) } : {}),
      ...(ogOverride ? { images: [{ url: ogOverride, alt: tenant.name }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(ogOverride ? { images: [ogOverride] } : {}),
    },
    robots: siteRobots(site ?? { indexable: false }),
  }
}

export default async function PublicMenuSlugPage({ params, searchParams }: Props) {
  const { slug, menuSlug } = await params
  const { lang, view, table: tableParam, dish, preview, feed_preview } = await searchParams

  // All queries in four parallel stages (src/lib/menu/public-menu-data.ts).
  // LOC-03: the second segment is a location slug first, else a menu slug.
  const data = await loadPublicMenuData({
    slug,
    menuSlug,
    // The table this link belongs to (QR code / NFC tag: ?table=<id>): guests
    // order to it, or call a waiter / ask for the bill from it.
    tableId: parseTableParam(tableParam),
    // Private menus gate on a phone-verified session; the loader checks it on
    // every request and returns no content without it (see below).
  })
  if (data.kind !== 'menu') {
    // Resolution order: menu, then branch (both in the loader above), then a published page, then 404.
    const target = await loadPublicPageTarget(slug, menuSlug)
    if (resolveSlugTarget(data.kind, !!target) !== 'page' || !target) notFound()
    const pageSettings = target.tenant.tenant_settings as any
    const site = await loadTenantSite(slug, `/${slug}/${menuSlug}`)
    const pageCanonical = site?.canonicalUrl ?? getCanonicalUrl(target.tenant, `/${menuSlug}`)
    return (
      <>
        <JsonLdScript data={buildBreadcrumbJsonLd([
          { name: target.tenant.name, url: site?.baseUrl ?? getCanonicalUrl(target.tenant, '/') },
          { name: target.page.title, url: pageCanonical },
        ])} />
        <TenantPageView
          tenant={{ name: target.tenant.name, slug: target.tenant.slug }}
          settings={pageSettings}
          page={target.page}
          nav={target.nav}
          lang={lang ?? pageSettings?.language ?? 'en'}
        />
      </>
    )
  }

  // SEED-019: a private/in-store menu scales every price on it the same way.
  const priced = withMenuPrices(data)
  const pageLinks = await loadPublicPageNav(data.tenant)
  const { tenant, menu, location, categories, capabilities, table, optionGroupsByProductId, productIngredientsByProductId } = priced

  // P0-08 round 2: scan recording moved client-side via <ScanRecorder /> —
  // this route reads searchParams, so it renders dynamically per request (only the data is cached, 60 s, by public-menu-cache); a server insert here would fire on every request.

  const primaryColor = (tenant.tenant_settings as any)?.primary_color ?? BRAND_PRIMARY
  const accentColor = (tenant.tenant_settings as any)?.accent_color ?? '#09090b'
  const primaryForeground = computePrimaryForeground(primaryColor)
  const canonicalPath = `/${menuSlug}`
  const site = await loadTenantSite(slug, `/${slug}/${menuSlug}`, { privatePage: menu?.is_private === true })
  const canonicalUrl = site?.canonicalUrl ?? getCanonicalUrl(tenant, canonicalPath)
  const currency = (tenant.tenant_settings as any)?.currency ?? 'USD'

  const displayProducts = priced.products ?? []

  const isPrivate = (menu as any)?.is_private ?? false

  const parentUrl = site?.baseUrl ?? getCanonicalUrl(tenant, '/')
  if (dish && !preview && !feed_preview && !tableParam && !isPrivate && site?.indexable && menu?.slug) {
    const product = displayProducts.find((product: Product) => product.id === dish && isIndexableDish(product))
    if (product) permanentRedirect(`${site.baseUrl}${dishPath(menu.slug, product)}`)
  }
  const navigation = await loadLocalNavigation(tenant.id, parentUrl)
  const tenantSettings = tenant.tenant_settings as any
  // SEO-08: when rendering a branch, use branch-specific LocalBusiness with branchOf.
  // Branches inherit price range and social profiles from the parent tenant.
  const localBusinessLd = location
    ? buildBranchJsonLd(location, canonicalUrl, parentUrl, {
        priceRange: tenantSettings?.price_range ?? null,
        sameAs: buildSameAs(tenantSettings),
        specialHours: tenantSettings?.special_hours,
        acceptsReservations: tenantSettings?.accepts_reservations,
        reservationUrl: tenantSettings?.reservation_url,
      })
    : buildLocalBusinessJsonLd(tenant, tenantSettings, parentUrl, {
        menuUrls: navigation.filter(link => link.kind === 'menu').map(link => link.href),
        branches: navigation.filter(link => link.kind === 'branch').map(link => ({ name: link.title, url: link.href })),
        areaServed: data.deliveryZones.map(zone => zone.name),
      })
  // Do not index private menus
  const menuLd = (menu && !isPrivate)
    ? buildMenuJsonLd(menu.name, canonicalUrl, categories ?? [], displayProducts, currency)
    : null
  // SEED-014: breadcrumb so this section nests under the tenant home in SERPs
  const sectionName = location?.name ?? menu?.name ?? 'Menu'
  const breadcrumbLd = !isPrivate
    ? buildBreadcrumbJsonLd([
        { name: tenant.name, url: parentUrl },
        { name: sectionName, url: canonicalUrl },
      ])
    : null

  // Private menus gate on a phone-verified session. This MUST be enforced
  // server-side: an ISR/RSC page serializes a client component's children into
  // the payload regardless of any client-side lock, so rendering the menu and
  // hiding it with a client overlay leaks the full "exclusive" menu + in-store
  // pricing to anyone who reads the response. When the caller is not
  // authenticated we render ONLY the lock screen and never build the menu.
  // The session check ran in loadPublicMenuData (checkPrivateAccess).
  const privateAuthed = isPrivate && data.privateAccess
  const directionsUrl = location ? branchDirectionsUrl(location) : null

  const menuPageEl = (
    <MenuPage
      tenant={sanitizeTenantForClient(tenant)}
      categories={categories ?? []}
      products={displayProducts}
      menu={menu}
      location={location ? { id: location.id, name: location.name } : null}
      dishDiscoveryEnabled={!preview && !feed_preview}
      initialLanguage={lang}
      initialView={view === 'feed' || view === 'list' ? view : undefined}
      footerBrand={siteFooterBrand(site, data.footerBrand)}
      optionGroupsByProductId={optionGroupsByProductId}
      productIngredientsByProductId={productIngredientsByProductId}
      deliveryZones={data.deliveryZones}
      productMediaByProductId={data.productMediaByProductId}
      productArModelByProductId={data.productArModelByProductId}
      chatAddonEnabled={data.chatAddonEnabled}
      chatAddonAudioEnabled={data.chatAddonAudioEnabled}
      chatAddonTextEnabled={data.chatAddonTextEnabled}
      capabilities={capabilities}
      pageLinks={pageLinks}
      navigationLinks={navigation}
      canonicalBaseUrl={parentUrl}
      publicNap={location ? { name: `${tenant.name} – ${location.name}`, address: location.address, city: location.city, phone: location.phone } : undefined}
      table={capabilities.guestOrdering ? table : null}
      waiterCallTable={capabilities.waiterCalls ? table : null}
    />
  )

  return (
    <>
      <style>{`:root{--primary:${safeCssColor(primaryColor)};--primary-foreground:${primaryForeground};--accent:${safeCssColor(accentColor)};}`}</style>
      <JsonLdScript data={localBusinessLd} />
      {menuLd && <JsonLdScript data={menuLd} />}
      {breadcrumbLd && <JsonLdScript data={breadcrumbLd} />}
      <ScanRecorder tenantId={tenant.id} />
      {location && !isPrivate && <section className="mx-auto max-w-5xl px-5 py-8 sm:px-8" aria-labelledby="branch-heading">
        <h1 id="branch-heading" className="text-3xl font-semibold tracking-tight text-zinc-950">{tenant.name} – {location.name}{location.city ? `, ${location.city}` : ''}</h1>
        <address className="mt-4 space-y-2 text-base not-italic text-zinc-700">
          {(location.address || location.city) && <p>{[location.address, location.city, location.region, location.postal_code, location.country].filter(Boolean).join(', ')}</p>}
          {location.phone && <p><a href={`tel:${location.phone.replace(/[^+\d]/g, '')}`} className="underline underline-offset-4">{location.phone}</a></p>}
        </address>
        {location.business_hours && <dl className="mt-5 grid max-w-md grid-cols-2 gap-2 text-sm text-zinc-700">{Object.entries(location.business_hours).filter(([, hours]) => typeof hours === 'string' && hours.trim()).map(([day, hours]) => <div key={day} className="contents"><dt className="font-medium">{({ mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' } as Record<string, string>)[day] ?? day}</dt><dd>{String(hours)}</dd></div>)}</dl>}
        <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold">
          {directionsUrl && <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Directions and map</a>}
          <a href="#branch-menu" className="underline underline-offset-4">View menu</a>
        </div>
      </section>}
      <div id="branch-menu" />
      {isPrivate ? (
        <PrivateMenuWrapper slug={slug} menuSlug={menuSlug} primaryColor={primaryColor} serverAuthed={privateAuthed}>
          {privateAuthed ? menuPageEl : null}
        </PrivateMenuWrapper>
      ) : menuPageEl}
    </>
  )
}
