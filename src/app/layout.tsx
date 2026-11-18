import { BRAND_NAME } from '@/lib/brand'
import landingCopy from '@/lib/marketing/landing-copy.json'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { getPlatformAppearance } from '@/lib/data/platform-appearance-runtime'
import { platformColors } from '@/lib/platform-colors'
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'
import { platformMetadataIcons } from '@/lib/platform-metadata'
import { PLATFORM_SOCIAL_IMAGE } from '@/lib/platform-brand'
import './globals.css'
import { requestSite } from '@/lib/site/request-runtime'
import { siteLocale } from '@/lib/site/request-contract'
import { tenantMonogramIcon } from '@/lib/tenant-metadata'
import { PublicLocaleProvider } from '@/components/marketing/PublicLocale'
import { getPublicLocale } from '@/lib/marketing/public-locale-server'
import { translatePublic } from '@/lib/marketing/public-translate'

// Authority/language are request data. Anonymous HTML is explicitly cached by
// middleware/Cloudflare; authenticated and parameterized responses remain private.
export const dynamic = 'force-dynamic'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  variable: '--font-inter',
})

export async function generateViewport(): Promise<Viewport> {
  const [ps, site] = await Promise.all([getPlatformAppearance(), requestSite()])
  return {
    themeColor: site.brand.name === BRAND_NAME ? platformColors(ps?.cta_color).primary : '#18181b',
    viewportFit: 'cover',
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const [ps, site] = await Promise.all([getPlatformAppearance(), requestSite()])
  const locale = await getPublicLocale()
  const appUrl = site.origin
  const partner = site.brand.name !== BRAND_NAME
  const appName = partner ? site.brand.name : BRAND_NAME
  return {
    title: {
      template: `%s | ${appName}`,
      default: partner ? appName : `${appName} | ${translatePublic(locale, landingCopy.seo.titleSuffix)}`,
    },
    description: partner ? undefined : translatePublic(locale, landingCopy.seo.description),
    metadataBase: new URL(appUrl),
    robots: { index: site.indexable, follow: site.indexable },
    applicationName: appName,
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: appName,
    },
    icons: partner ? { icon: site.brand.icon || tenantMonogramIcon(appName), apple: site.brand.icon || tenantMonogramIcon(appName) } : platformMetadataIcons(ps?.favicon_url),
    openGraph: {
      type: 'website',
      locale: siteLocale(site.lang),
      siteName: appName,
      images: partner ? (site.brand.social_image ? [{ url: site.brand.social_image, alt: appName }] : []) : [{ url: PLATFORM_SOCIAL_IMAGE, width: 1200, height: 630, alt: appName }],
    },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [ps, site] = await Promise.all([getPlatformAppearance(), requestSite()])
  const locale = await getPublicLocale()
  const { primary, onPrimary } = platformColors(site.brand.name === BRAND_NAME ? ps?.cta_color : '#18181b')

  return (
    <html lang={site.lang} className={`h-full antialiased ${inter.variable}`}>
      <head>
        <style>{`:root{--primary:${primary};--primary-foreground:${onPrimary};}`}</style>
      </head>
      <body className={`${inter.className} min-h-full`}>
        <PublicLocaleProvider locale={locale}>{children}</PublicLocaleProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
