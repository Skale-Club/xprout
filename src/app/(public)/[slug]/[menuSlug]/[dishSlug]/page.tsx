import { siteLocale } from '@/lib/site/request-contract'
import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { renamedMenuSlug } from '@/lib/menu/renamed-menu-slugs'
import JsonLdScript from '@/components/seo/JsonLdScript'
import { DeliveryImage } from '@/components/delivery-image'
import MenuPage from '@/components/menu/MenuPage'
import DishCartButton from '@/components/menu/DishCartButton'
import { fill, formatMoney, getMenuCopy, translateTag } from '@/components/menu/menu-i18n'
import { getGuestCopy } from '@/components/menu/guest-copy'
import { getDishPageCopy } from '@/components/menu/dish-page-copy'
import { optionPriceList } from '@/components/menu/showcase'
import { ui } from '@/components/menu/menu-ui'
import { loadPublicDish } from '@/lib/menu/dish-pages-runtime'
import { dishJsonLd } from '@/lib/menu/dish-pages'
import { dishFeature } from '@/lib/menu/dish-tags'
import { loadPublicMenuData, withMenuPrices } from '@/lib/menu/public-menu-data'
import { loadLocalNavigation } from '@/lib/menu/local-navigation'
import { loadTenantSite } from '@/lib/site/runtime'
import { siteRobots } from '@/lib/site/indexability'
import { siteFooterBrand } from '@/lib/site/footer-brand'
import { sanitizeTenantForClient } from '@/lib/tenant-public'
import { buildBreadcrumbJsonLd, toPublicAssetUrl } from '@/lib/seo'
import { computePrimaryForeground, safeCssColor } from '@/lib/color-utils'
import { BRAND_PRIMARY } from '@/lib/brand'
import { loadPublicPageNav } from '@/lib/data/tenant-pages-runtime'
import DishMedia from '@/components/menu/DishMedia'

type Props = {
  params: Promise<{ slug: string; menuSlug: string; dishSlug: string }>
  searchParams?: Promise<{ lang?: string }>
}

async function loadDish(params: Props['params'], requestedLang?: string | null) {
  const { slug, menuSlug, dishSlug } = await params
  const site = await loadTenantSite(slug, `/${slug}/${menuSlug}/${dishSlug}`)
  if (!site) return null
  const plain = await loadPublicDish(slug, menuSlug, dishSlug)
  if (!plain) return null
  // One language for the whole page: ?lang= when the menu offers it, else the site's, else the menu's.
  const offered = plain.menu.supported_languages?.length ? plain.menu.supported_languages : [plain.menu.language]
  const lang = [requestedLang, site.lang].find(code => !!code && offered.includes(code)) ?? plain.menu.language ?? site.lang
  const found = lang === plain.menu.language ? plain : await loadPublicDish(slug, menuSlug, dishSlug, lang) ?? plain
  return { ...found, site, lang, slug, menuSlug, menuUrl: `${site.baseUrl}/${menuSlug}`,
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

/**
 * A dish's own page, reached from search and shared links. It is drawn inside the menu itself
 * (MenuPage `dishPage`): the menu's header, footer, order bar, cart and checkout, with the dish
 * (photo or 3D, name, price, add to order, sizes, ingredients) and more dishes of the same menu
 * in place of the dish list. Owner rule: no menu button on this page; the breadcrumb leads back.
 */
export default async function DishPage({ params, searchParams }: Props) {
  const found = await loadDish(params, (await searchParams)?.lang)
  if (!found) {
    // A dish under a renamed menu's old address, once that menu is gone.
    const { slug, menuSlug, dishSlug } = await params
    const renamed = renamedMenuSlug(slug, menuSlug)
    if (renamed) permanentRedirect(`/${slug}/${renamed}/${dishSlug}`)
    notFound()
  }
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
  const copy = getGuestCopy(found.lang)
  const menuCopy = getMenuCopy(found.lang)
  const pageCopy = getDishPageCopy(found.lang)
  const base = site.baseUrl.replace(/\/$/, '')
  const money = (value: number) => formatMoney(value, currency, found.lang)
  const priceText = (value: { amount: number; from: boolean }) => value.from ? fill(copy.fromPrice, { price: money(value.amount) }) : money(value.amount)
  // The menu's name as its header shows it in this language.
  const menuName = (menu.translations as Record<string, { name?: string }> | null | undefined)?.[found.lang]?.name?.trim() || menu.name
  // Owner rule: one feature pill per dish, everywhere.
  const feature = dishFeature(product)
  // A promotion shows the old price struck through, as on the menu cards (not for "from" prices).
  const wasPrice = !price.from && product.original_price !== null && product.original_price !== undefined && Number(product.original_price) > price.amount ? Number(product.original_price) : null

  // The menu around the dish: the same data the menu page reads (cached), so the header, footer,
  // order and checkout behave exactly as there. loadPublicDish already refused private menus.
  const [data, pageLinks, navigation] = await Promise.all([
    loadPublicMenuData({ slug: found.slug, menuSlug: found.menuSlug, tableId: null }),
    loadPublicPageNav(tenant).catch(() => []),
    loadLocalNavigation(tenant.id, site.baseUrl).catch(() => []),
  ])
  if (data.kind !== 'menu' || !data.menu) notFound()
  const priced = withMenuPrices(data)

  const dishContent = <>
    <nav aria-label="Breadcrumb" className="mb-5 flex min-w-0 items-center gap-2 text-[14px] text-zinc-500 sm:mb-8">
      <a href={base || '/'} className="shrink-0 underline-offset-4 hover:text-zinc-900 hover:underline">{tenant.name}</a>
      <span aria-hidden="true" className="text-zinc-300">/</span>
      <a href={menuUrl} className="shrink-0 underline-offset-4 hover:text-zinc-900 hover:underline">{menuName}</a>
      <span aria-hidden="true" className="hidden text-zinc-300 sm:inline">/</span>
      <span aria-current="page" className="hidden truncate text-zinc-800 sm:inline">{product.name}</span>
    </nav>

    <article className="grid items-start gap-7 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:gap-12">
      <DishMedia name={product.name} photo={toPublicAssetUrl(product.image_url!)} arModel={arModel} lang={found.lang} primary={primary} accent={accent} />

      <div className="md:sticky md:top-8 md:pt-2">
        {(category || feature) && (
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            {category && <p className={`${ui.label} text-zinc-500`}>{category}</p>}
            {feature && <p className="inline-flex rounded-full bg-zinc-900 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-white">{translateTag(feature, found.lang)}</p>}
          </div>
        )}
        <h1 className={`text-[34px] text-zinc-950 sm:text-[44px] ${ui.dishTitle}`}>{product.name}</h1>
        <p className="mt-4 flex flex-wrap items-baseline gap-x-3">
          <span className={`text-[26px] ${ui.price}`} style={{ color: accent }}>{priceText(price)}</span>
          {wasPrice !== null && <s className="text-[17px] font-semibold tabular-nums text-zinc-400">{money(wasPrice)}</s>}
        </p>
        <p className="mt-5 whitespace-pre-line text-[17px] leading-relaxed text-zinc-700">{product.description}</p>
        {/* Only when guests can order here; a dish with choices opens the dish sheet. */}
        <div className="mt-7 empty:hidden"><DishCartButton productId={product.id} name={product.name} /></div>

        {sizes.map(group => (
          <section key={group.id} className="mt-8" aria-labelledby={`size-${group.id}`}>
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
          <section className="mt-8" aria-labelledby="dish-ingredients">
            <h2 id="dish-ingredients" className={`${ui.label} text-zinc-500`}>{menuCopy.ingredients}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-700">{ingredients.join(', ')}</p>
          </section>
        )}
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
  </>

  return <>
    <style>{`:root{--primary:${primary};--primary-foreground:${onPrimary};--accent:${accent};}`}</style>
    <JsonLdScript data={dishJsonLd(product, site.canonicalUrl, menuUrl, currency, imageUrl, price)} />
    <JsonLdScript data={buildBreadcrumbJsonLd([{ name: tenant.name, url: site.baseUrl }, { name: menu.name, url: menuUrl }, { name: product.name, url: site.canonicalUrl }])} />
    <MenuPage
      tenant={sanitizeTenantForClient(priced.tenant)}
      categories={priced.categories ?? []}
      products={priced.products ?? []}
      menu={priced.menu}
      location={null}
      dishDiscoveryEnabled
      initialLanguage={found.lang}
      footerBrand={siteFooterBrand(site, data.footerBrand)}
      optionGroupsByProductId={priced.optionGroupsByProductId}
      productIngredientsByProductId={priced.productIngredientsByProductId}
      deliveryZones={data.deliveryZones}
      productMediaByProductId={data.productMediaByProductId}
      productArModelByProductId={data.productArModelByProductId}
      chatAddonEnabled={data.chatAddonEnabled}
      chatAddonAudioEnabled={data.chatAddonAudioEnabled}
      chatAddonTextEnabled={data.chatAddonTextEnabled}
      chatAddonSuggestionsEnabled={data.chatAddonSuggestionsEnabled}
      chatAddonHistoryEnabled={data.chatAddonHistoryEnabled}
      capabilities={data.capabilities}
      pageLinks={pageLinks}
      navigationLinks={navigation}
      canonicalBaseUrl={site.baseUrl}
      dishPage={dishContent}
    />
  </>
}
