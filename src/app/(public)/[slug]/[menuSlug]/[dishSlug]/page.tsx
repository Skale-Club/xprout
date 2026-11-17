import { siteLocale } from '@/lib/site/request-contract'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MapPin, Phone } from 'lucide-react'
import JsonLdScript from '@/components/seo/JsonLdScript'
import { DeliveryImage } from '@/components/delivery-image'
import { fill, formatMoney, getMenuCopy, localeFor, translateTag } from '@/components/menu/menu-i18n'
import { getGuestCopy } from '@/components/menu/guest-copy'
import { getDishPageCopy } from '@/components/menu/dish-page-copy'
import { optionPriceList, phoneLabel, telUrl } from '@/components/menu/showcase'
import { ui } from '@/components/menu/menu-ui'
import { loadPublicDish } from '@/lib/menu/dish-pages-runtime'
import { branchDirectionsUrl, dishJsonLd } from '@/lib/menu/dish-pages'
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

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('')

/**
 * A dish's own page, reached from search and shared links: the dish first (photo or 3D, name,
 * price, what is in it), then where it is served, then other dishes of the same menu.
 * Owner rule: no menu button anywhere on this page; the breadcrumb leads back to the menu.
 */
export default async function DishPage({ params }: Props) {
  const found = await loadDish(params)
  if (!found) notFound()
  const { tenant, menu, product, price, site, menuUrl, imageUrl, arModel } = found
  const category = found.category ?? null
  const sizes = found.sizes ?? []
  const ingredients = found.ingredients ?? []
  const related = found.related ?? []
  const settings = tenant.tenant_settings
  const primary = safeCssColor(settings?.primary_color ?? BRAND_PRIMARY)
  const onPrimary = computePrimaryForeground(primary)
  const accent = safeCssColor(settings?.accent_color ?? '#18181b')
  const currency = settings?.currency ?? 'USD'
  const copy = getGuestCopy(site.lang)
  const menuCopy = getMenuCopy(site.lang)
  const pageCopy = getDishPageCopy(site.lang)
  const nav = await loadPublicPageNav(tenant).catch(() => [])
  const base = site.baseUrl.replace(/\/$/, '')
  const money = (value: number) => formatMoney(value, currency, site.lang)
  const priceText = (value: { amount: number; from: boolean }) => value.from ? fill(copy.fromPrice, { price: money(value.amount) }) : money(value.amount)
  // Owner rule: one feature pill per dish, everywhere.
  const feature = dishFeature(product)
  // A promotion shows the old price struck through, as on the menu cards (not for "from" prices).
  const wasPrice = !price.from && product.original_price !== null && Number(product.original_price) > price.amount ? Number(product.original_price) : null
  // Where it is served: the restaurant's own address line, with the city only when the line lacks it.
  const address = settings?.address?.trim() || null
  const place = [address, settings?.city && !address?.toLowerCase().includes(settings.city.toLowerCase()) ? settings.city : null].filter(Boolean).join(', ')
  const directions = settings ? branchDirectionsUrl(settings) : null
  const phoneContext = { country: settings?.country, currency }
  const call = telUrl(settings?.phone, phoneContext)

  return <div className="menu-root min-h-screen bg-menu text-zinc-900" lang={localeFor(site.lang)}
    style={{ '--primary': primary, '--primary-foreground': onPrimary } as React.CSSProperties}>
    <TenantSiteHeader tenant={tenant} logoUrl={settings?.logo_url} base={base} nav={nav} pagesLabel={menuCopy.pagesMore} />
    <JsonLdScript data={dishJsonLd(product, site.canonicalUrl, menuUrl, currency, imageUrl, price)} />
    <JsonLdScript data={buildBreadcrumbJsonLd([{ name: tenant.name, url: site.baseUrl }, { name: menu.name, url: menuUrl }, { name: product.name, url: site.canonicalUrl }])} />

    <main className="mx-auto max-w-5xl px-5 pb-16 pt-5 sm:px-8 sm:pt-8">
      <nav aria-label="Breadcrumb" className="mb-5 flex min-w-0 items-center gap-2 text-[14px] text-zinc-500 sm:mb-8">
        <a href={base || '/'} className="shrink-0 underline-offset-4 hover:text-zinc-900 hover:underline">{tenant.name}</a>
        <span aria-hidden="true" className="text-zinc-300">/</span>
        <a href={menuUrl} className="shrink-0 underline-offset-4 hover:text-zinc-900 hover:underline">{menu.name}</a>
        <span aria-hidden="true" className="hidden text-zinc-300 sm:inline">/</span>
        <span aria-current="page" className="hidden truncate text-zinc-800 sm:inline">{product.name}</span>
      </nav>

      <article className="grid items-start gap-7 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:gap-12">
        <DishMedia name={product.name} photo={toPublicAssetUrl(product.image_url!)} arModel={arModel} lang={site.lang} primary={primary} accent={accent} />

        <div className="md:sticky md:top-8 md:pt-2">
          {(category || feature) && (
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
              {category && <p className={`${ui.label} text-zinc-500`}>{category}</p>}
              {feature && <p className="inline-flex rounded-full bg-zinc-900 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-white">{translateTag(feature, site.lang)}</p>}
            </div>
          )}
          <h1 className={`text-[34px] text-zinc-950 sm:text-[44px] ${ui.dishTitle}`}>{product.name}</h1>
          <p className="mt-4 flex flex-wrap items-baseline gap-x-3">
            <span className={`text-[26px] ${ui.price}`} style={{ color: accent }}>{priceText(price)}</span>
            {wasPrice !== null && <s className="text-[17px] font-semibold tabular-nums text-zinc-400">{money(wasPrice)}</s>}
          </p>
          <p className="mt-5 whitespace-pre-line text-[17px] leading-relaxed text-zinc-700">{product.description}</p>

          {sizes.map(group => (
            <section key={group.id} className="mt-7" aria-labelledby={`size-${group.id}`}>
              <h2 id={`size-${group.id}`} className={`${ui.label} text-zinc-500`}>{group.name}</h2>
              <ul className="mt-2 divide-y divide-zinc-200/80 rounded-2xl bg-white px-4 shadow-card ring-1 ring-black/5">
                {optionPriceList(group, money).map(row => (
                  <li key={row.id} className="flex min-h-12 items-center justify-between gap-4 py-2 text-[15px]">
                    <span className="text-zinc-800">{row.name}</span>
                    {row.price && <span className="font-bold tabular-nums text-zinc-900">{row.price}</span>}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {ingredients.length > 0 && (
            <section className="mt-7" aria-labelledby="dish-ingredients">
              <h2 id="dish-ingredients" className={`${ui.label} text-zinc-500`}>{menuCopy.ingredients}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-zinc-700">{ingredients.join(', ')}</p>
            </section>
          )}

          <section className="mt-8 rounded-3xl bg-white p-4 shadow-card ring-1 ring-black/5 sm:p-5" aria-label={pageCopy.servedAt}>
            <div className="flex items-center gap-3">
              <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
                {settings?.logo_url
                  ? <DeliveryImage src={settings.logo_url} alt="" width={96} height={96} sizes="48px" className="size-full object-contain p-1.5" />
                  : <span className="text-sm font-semibold text-zinc-700">{initials(tenant.name)}</span>}
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-zinc-500">{pageCopy.servedAt}</p>
                <p className="truncate text-[16px] font-bold tracking-tight text-zinc-900">{tenant.name}</p>
                {place && <p className="text-[14px] leading-snug text-zinc-600">{place}</p>}
              </div>
            </div>
            {(directions || call) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {directions && (
                  <a href={directions} target="_blank" rel="noopener noreferrer" className={`h-11 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 ${ui.ctaQuiet}`}>
                    <MapPin className="size-4" aria-hidden="true" />{pageCopy.directions}
                  </a>
                )}
                {call && (
                  <a href={call} className={`h-11 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 ${ui.ctaQuiet}`} aria-label={`${pageCopy.call} ${phoneLabel(settings?.phone, phoneContext)}`}>
                    <Phone className="size-4" aria-hidden="true" />{pageCopy.call}
                  </a>
                )}
              </div>
            )}
          </section>
        </div>
      </article>

      {related.length > 0 && (
        <section className="mt-14 border-t border-zinc-200/80 pt-10 sm:mt-20" aria-labelledby="more-dishes">
          <h2 id="more-dishes" className={`text-zinc-900 ${ui.sectionTitle}`}>{pageCopy.moreDishes}</h2>
          <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4">
            {related.map(dish => (
              <li key={dish.id}>
                <a href={`${menuUrl}/${dish.slug}`} className="group block">
                  <span className="block overflow-hidden rounded-2xl bg-zinc-100 shadow-card ring-1 ring-black/5">
                    <DeliveryImage src={toPublicAssetUrl(dish.image_url)} alt="" width={480} height={480}
                      sizes="(max-width: 767px) calc(50vw - 28px), 230px"
                      className="aspect-square h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  </span>
                  <span className={`mt-3 line-clamp-2 block text-[15px] text-zinc-900 ${ui.dishTitleCompact}`}>{dish.name}</span>
                  <span className="mt-1 block text-[14px] font-bold tabular-nums" style={{ color: accent }}>{priceText(dish.price)}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
    <TenantSiteFooter tenant={tenant} settings={settings} baseUrl={site.baseUrl} links={[{ title: menu.name, href: menuUrl }]} />
  </div>
}
