import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { requestSite } from '@/lib/site/request-runtime'
import { siteLocale } from '@/lib/site/request-contract'
import { getTenantBySlug } from '@/lib/menu/public-menu-data'
import { loadPublicPages } from '@/lib/data/tenant-pages-runtime'
import TenantPageView from '@/components/pages/TenantPageView'
import JsonLdScript from '@/components/seo/JsonLdScript'
import { PlatformTagManager } from '@/components/tracking/PlatformTagManager'

type Props = { params: Promise<{ host: string; segments?: string[] }> }
const DEFAULT_BRAND_ID = '00000000-0000-4000-8000-000000000001'

async function pageTarget(props: Props) {
  const [{ host, segments = [] }, site] = await Promise.all([props.params, requestSite()])
  if (host !== site.brand.primary_host || !site.rewrite?.startsWith(`/brand-site/${host}`)) notFound()
  if (!site.tenant) {
    if (segments.length) notFound()
    return { site, tenant: null, page: null, nav: [], codedFallback: site.brand.id === DEFAULT_BRAND_ID }
  }
  if (segments.length > 1) notFound()
  const tenant = await getTenantBySlug(site.tenant.slug)
  if (!tenant) {
    if (segments.length) notFound()
    return { site, tenant: null, page: null, nav: [], codedFallback: site.brand.id === DEFAULT_BRAND_ID }
  }
  const { page, nav } = await loadPublicPages(tenant, segments[0] ?? site.brand.apex_home_slug ?? 'home')
  if (!page && segments.length) notFound()
  return { site, tenant, page, nav, codedFallback: !page && site.brand.id === DEFAULT_BRAND_ID }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { site, tenant, page, codedFallback } = await pageTarget(props)
  if (codedFallback) {
    const { generateMetadata: marketingMetadata } = await import('@/app/(marketing)/page')
    const metadata = await marketingMetadata()
    return { ...metadata, alternates: { ...metadata.alternates, canonical: site.canonicalUrl },
      robots: { index: site.indexable, follow: site.indexable },
      openGraph: { ...metadata.openGraph, url: site.canonicalUrl, locale: siteLocale(site.lang) } }
  }
  const title = page?.title ?? site.brand.name
  const description = page?.description || (tenant?.tenant_settings?.about as string | undefined)
  return { title: { absolute: `${title}${title === site.brand.name ? '' : ` | ${site.brand.name}`}` }, description,
    applicationName: site.brand.name, metadataBase: new URL(site.origin),
    alternates: { canonical: site.canonicalUrl }, robots: { index: site.indexable, follow: site.indexable },
    icons: site.brand.icon ? { icon: site.brand.icon, apple: site.brand.icon } : {},
    openGraph: { title, description, siteName: site.brand.name, url: site.canonicalUrl, type: 'website', locale: siteLocale(site.lang),
      ...(site.brand.social_image ? { images: [site.brand.social_image] } : {}) },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function BrandSitePage(props: Props) {
  const { site, tenant, page, nav, codedFallback } = await pageTarget(props)
  if (codedFallback) {
    const [{ default: MarketingPage }, { default: MarketingLayout }] = await Promise.all([
      import('@/app/(marketing)/page'), import('@/app/(marketing)/layout'),
    ])
    return MarketingLayout({ children: await MarketingPage() })
  }
  const businessKind = site.tenant?.business_kind ?? 'software'
  const entity = { '@context': 'https://schema.org', '@type': businessKind === 'restaurant' ? 'Restaurant' : businessKind === 'agency' ? 'ProfessionalService' : 'Organization',
    '@id': `${site.origin}#organization`, name: tenant?.name ?? site.brand.name, url: site.origin,
    ...(site.brand.logo ? { logo: new URL(site.brand.logo, site.origin).href } : {}) }
  return <>
    <JsonLdScript data={entity} />
    {businessKind === 'software' && <JsonLdScript data={{ '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: tenant?.name ?? site.brand.name, applicationCategory: 'BusinessApplication', operatingSystem: 'Web', url: site.origin }} />}
    {site.brand.gtm_id && <PlatformTagManager containerId={site.brand.gtm_id} />}
    {tenant && page ? <TenantPageView tenant={{ name: tenant.name, slug: tenant.slug }} settings={tenant.tenant_settings} page={page}
      nav={nav.map(item => ({ ...item, slug: item.slug === site.brand.apex_home_slug ? '' : item.slug }))} lang={site.lang} baseUrl={site.origin} />
      : <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-6 px-6 py-20">
        <h1 className="text-4xl font-semibold tracking-tight">{site.brand.name}</h1>
        <p className="max-w-xl text-lg leading-relaxed">Welcome to {site.brand.name}. Sign in to continue or contact our team.</p>
        {nav.length > 0 && <nav aria-label="Public pages" className="flex flex-wrap gap-5 text-sm">
          {nav.map(item => <a key={item.slug} href={`${site.origin}/${item.slug}`} className="underline underline-offset-4">{item.title}</a>)}
        </nav>}
        {site.brand.support_email && <a href={`mailto:${site.brand.support_email}`} className="underline">Contact {site.brand.name}</a>}
        <Link href={`/auth/login?brand=${encodeURIComponent(site.brand.id)}`} className="w-fit rounded-full bg-zinc-900 px-6 py-3 text-white">Sign in</Link>
        <footer className="flex flex-wrap gap-6 text-sm">
          {site.brand.privacy_url && <a href={site.brand.privacy_url}>Privacy policy</a>}
          {site.brand.terms_url && <a href={site.brand.terms_url}>Terms of service</a>}
        </footer>
      </main>}
  </>
}
