import { siteLocale } from '@/lib/site/request-contract'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DeliveryImage } from '@/components/delivery-image'
import JsonLdScript from '@/components/seo/JsonLdScript'
import { fill, formatMoney, translateTag } from '@/components/menu/menu-i18n'
import { getGuestCopy } from '@/components/menu/guest-copy'
import { loadPublicDish } from '@/lib/menu/dish-pages-runtime'
import { dishJsonLd } from '@/lib/menu/dish-pages'
import { loadTenantSite } from '@/lib/site/runtime'
import { siteRobots } from '@/lib/site/indexability'
import { buildBreadcrumbJsonLd, toPublicAssetUrl } from '@/lib/seo'
import { computePrimaryForeground, safeCssColor } from '@/lib/color-utils'
import { BRAND_PRIMARY } from '@/lib/brand'

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
  const { tenant, menu, product, price, site, menuUrl, imageUrl } = found
  const settings = tenant.tenant_settings
  const primary = safeCssColor(settings?.primary_color ?? BRAND_PRIMARY)
  const accent = safeCssColor(settings?.accent_color ?? '#18181b')
  const currency = settings?.currency ?? 'USD'
  const copy = getGuestCopy(site.lang)
  return <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8" style={{ '--primary': primary, '--primary-foreground': computePrimaryForeground(primary) } as React.CSSProperties}>
    <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap gap-3 text-sm text-zinc-600">
      <a href={site.baseUrl} className="underline-offset-4 hover:underline">{tenant.name}</a><span aria-hidden="true">/</span>
      <a href={menuUrl} className="underline-offset-4 hover:underline">{menu.name}</a>
    </nav>
    <JsonLdScript data={dishJsonLd(product, site.canonicalUrl, menuUrl, currency, imageUrl, price)} />
    <JsonLdScript data={buildBreadcrumbJsonLd([{ name: tenant.name, url: site.baseUrl }, { name: menu.name, url: menuUrl }, { name: product.name, url: site.canonicalUrl }])} />
    <article className="grid gap-8 md:grid-cols-2">
      <DeliveryImage src={toPublicAssetUrl(product.image_url!)} alt={product.name} width={900} height={900} sizes="(max-width: 767px) calc(100vw - 40px), 450px" className="aspect-square h-auto w-full rounded-2xl object-cover" priority />
      <div className="space-y-5">
        <p className="text-sm text-zinc-500">{tenant.name}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">{product.name}</h1>
        <p className="text-xl font-semibold tabular-nums" style={{ color: accent }}>{price.from ? fill(copy.fromPrice, { price: formatMoney(price.amount, currency, site.lang) }) : formatMoney(price.amount, currency, site.lang)}</p>
        <p className="whitespace-pre-line text-base leading-7 text-zinc-700">{product.description}</p>
        {product.tags?.length > 0 && <ul aria-label="Dish labels" className="flex flex-wrap gap-2">{product.tags.map(tag => <li key={tag} className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700">{translateTag(tag, site.lang)}</li>)}</ul>}
        <a href={menuUrl} className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground">{menu.name}</a>
      </div>
    </article>
  </main>
}
