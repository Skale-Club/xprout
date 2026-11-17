import { siteLocale } from '@/lib/site/request-contract'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import JsonLdScript from '@/components/seo/JsonLdScript'
import { fill, formatMoney, getMenuCopy, localeFor, translateTag } from '@/components/menu/menu-i18n'
import { getGuestCopy } from '@/components/menu/guest-copy'
import { loadPublicDish } from '@/lib/menu/dish-pages-runtime'
import { dishJsonLd } from '@/lib/menu/dish-pages'
import { dishFeature } from '@/lib/menu/dish-tags'
import { loadTenantSite } from '@/lib/site/runtime'
import { siteRobots } from '@/lib/site/indexability'
import { buildBreadcrumbJsonLd, toPublicAssetUrl } from '@/lib/seo'
import { computePrimaryForeground, safeCssColor } from '@/lib/color-utils'
import { BRAND_PRIMARY } from '@/lib/brand'
import { loadPublicPageNav } from '@/lib/data/tenant-pages-runtime'
import TenantSiteFooter from '@/components/pages/TenantSiteFooter'
import TenantSiteHeader from '@/components/pages/TenantSiteHeader'
import DishMedia from '@/components/menu/DishMedia'

type Props = { params: Promise<{ slug: string; menuSlug: string; dishSlug: string }> }

async function loadDish(params: Props['params']) {
  const { slug, menuSlug, dishSlug } = await params
  const found = await loadPublicDish(slug, menuSlug, dishSlug)
  if (!found) return null
  const site = await loadTenantSite(slug, `/${slug}/${menuSlug}/${dishSlug}`)
  if (!site) return null
  return { ...found, site, menuUrl: `${site.baseUrl}/${menuSlug}`,
    imageUrl: new URL(toPublicAssetUrl(found.product.image_url!), site.origin).href }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await loadDish(params)
  if (!found) return { title: 'Dish', robots: { index: false, follow: false } }
  const { tenant, product, site, imageUrl } = found
  const title = `${product.name} – ${tenant.name}${tenant.tenant_settings?.city ? `, ${tenant.tenant_settings.city}` : ''}`
  const description = product.description!.trim().slice(0, 200)
  return { title: { absolute: title }, description, metadataBase: new URL(site.origin),
    alternates: { canonical: site.canonicalUrl }, robots: siteRobots(site),
    openGraph: { type: 'website', title, description, siteName: tenant.name, url: site.canonicalUrl,
      locale: siteLocale(site.lang), images: [{ url: imageUrl, alt: product.name }] },
    twitter: { card: 'summary_large_image', title, description, images: [imageUrl] } }
}

export default async function DishPage({ params }: Props) {
  const found = await loadDish(params)
  if (!found) notFound()
  const { tenant, menu, product, price, site, menuUrl, imageUrl, arModel } = found
  const settings = tenant.tenant_settings
  const primary = safeCssColor(settings?.primary_color ?? BRAND_PRIMARY)
  const onPrimary = computePrimaryForeground(primary)
  const accent = safeCssColor(settings?.accent_color ?? '#18181b')
  const currency = settings?.currency ?? 'USD'
  const copy = getGuestCopy(site.lang)
  const menuCopy = getMenuCopy(site.lang)
  const nav = await loadPublicPageNav(tenant).catch(() => [])
  const base = site.baseUrl.replace(/\/$/, '')
  // Owner rule: one feature pill per dish, everywhere.
  const feature = dishFeature(product)
  const priceLabel = price.from ? fill(copy.fromPrice, { price: formatMoney(price.amount, currency, site.lang) }) : formatMoney(price.amount, currency, site.lang)

  return <div className="menu-root min-h-screen bg-menu text-zinc-900" lang={localeFor(site.lang)}
    style={{ '--primary': primary, '--primary-foreground': onPrimary } as React.CSSProperties}>
    <TenantSiteHeader tenant={tenant} logoUrl={settings?.logo_url} base={base} nav={nav}
      menuLabel={menu.name} menuHref={menuUrl} pagesLabel={menuCopy.pagesMore} />
    <JsonLdScript data={dishJsonLd(product, site.canonicalUrl, menuUrl, currency, imageUrl, price)} />
    <JsonLdScript data={buildBreadcrumbJsonLd([{ name: tenant.name, url: site.baseUrl }, { name: menu.name, url: menuUrl }, { name: product.name, url: site.canonicalUrl }])} />

    <main className="mx-auto max-w-5xl px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-[14px] text-zinc-500 sm:mb-8">
        <a href={base || '/'} className="underline-offset-4 hover:text-zinc-900 hover:underline">{tenant.name}</a>
        <span aria-hidden="true">/</span>
        <a href={menuUrl} className="underline-offset-4 hover:text-zinc-900 hover:underline">{menu.name}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="truncate text-zinc-800">{product.name}</span>
      </nav>

      <article className="grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-12">
        <DishMedia name={product.name} photo={toPublicAssetUrl(product.image_url!)} arModel={arModel} lang={site.lang} primary={primary} accent={accent} />

        <div className="md:sticky md:top-8">
          {feature && (
            <p className="mb-4 inline-flex rounded-full bg-zinc-900 px-3 py-1 text-[12px] font-bold uppercase tracking-[0.08em] text-white">{translateTag(feature, site.lang)}</p>
          )}
          <h1 className="text-[32px] font-bold leading-[1.1] tracking-tight text-zinc-950 sm:text-[42px]">{product.name}</h1>
          <p className="mt-3 text-[24px] font-bold tabular-nums" style={{ color: accent }}>{priceLabel}</p>
          <p className="mt-5 whitespace-pre-line text-[17px] leading-relaxed text-zinc-700">{product.description}</p>
          {/* Owner rule: no "back to the menu" button here; the breadcrumb above already leads back. */}
          <div className="mt-8 border-t border-zinc-200 pt-6">
            <p className="text-[14px] text-zinc-500">{tenant.name}{settings?.city ? ` · ${settings.city}` : ''}</p>
          </div>
        </div>
      </article>
    </main>
    <TenantSiteFooter tenant={tenant} settings={settings} baseUrl={site.baseUrl} links={[{ title: menu.name, href: menuUrl }]} />
  </div>
}
