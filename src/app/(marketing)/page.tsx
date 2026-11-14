export const revalidate = 60

import { BRAND_NAME } from '@/lib/brand'
import type { Metadata } from 'next'
import landingCopy from '@/lib/marketing/landing-copy.json'
import { createServiceClient } from '@/lib/supabase/server'
import {
  PLATFORM_BASE,
  buildPlatformOrganizationJsonLd,
  buildWebSiteJsonLd,
  buildSoftwareApplicationJsonLd,
} from '@/lib/seo'
import ClientLandingPage from './ClientPage'
import { platformSettingsOwned } from '@/lib/data/platform-settings'

interface LandingSettings {
  landing: unknown; app_name: string | null; favicon_url: string | null
  seo_title: string | null; seo_description: string | null; social_links: unknown
}

async function getPlatformSettings() {
  try {
    let data: LandingSettings | null
    if (platformSettingsOwned()) {
      // Own PostgreSQL only: a failure falls back to the defaults, never to Supabase.
      const { readOwnedPlatformSettings } = await import('@/lib/data/platform-settings-runtime')
      data = await readOwnedPlatformSettings(['landing', 'app_name', 'favicon_url', 'seo_title', 'seo_description', 'social_links']) as LandingSettings | null
    } else {
      const service = createServiceClient()
      data = (await service
        .from('platform_settings')
        .select('landing, app_name, favicon_url, seo_title, seo_description, social_links')
        .single()).data
    }
    return {
      landing: data?.landing ?? null,
      appName: data?.app_name ?? null,
      logoUrl: data?.favicon_url ?? null,
      title: data?.seo_title ?? null,
      description: data?.seo_description ?? null,
      socialLinks: Array.isArray(data?.social_links) ? (data!.social_links as string[]) : [],
    }
  } catch {
    return { landing: null, appName: null, logoUrl: null, title: null, description: null, socialLinks: [] }
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPlatformSettings()
  const name = settings.appName ?? BRAND_NAME
  const title = settings.title ?? `${name} | ${landingCopy.seo.titleSuffix}`
  const description = settings.description ?? landingCopy.seo.description
  return {
    title: { absolute: title }, description,
    openGraph: {
      title, description, url: PLATFORM_BASE, siteName: name, type: 'website', locale: 'en_US',
      images: [{ url: '/opengraph-image?v=xprout-v1', width: 1200, height: 630, alt: name }],
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function LandingPage() {
  const { landing: platformLanding, appName, logoUrl, description, socialLinks } = await getPlatformSettings()
  const name = appName ?? BRAND_NAME

  const organization = buildPlatformOrganizationJsonLd({
    name,
    url: PLATFORM_BASE,
    description: description ?? landingCopy.seo.description,
    logoUrl,
    sameAs: socialLinks,
  })
  const website = buildWebSiteJsonLd({ name, url: PLATFORM_BASE })
  const software = buildSoftwareApplicationJsonLd({ name })

  return (
    <>
      {/* JSON-LD structured data. Inline dangerouslySetInnerHTML only.
          Do NOT use the Script component for JSON-LD (causes RSC hydration duplicates in React 19).
          NEVER move this to layout.tsx (would appear on all tenant pages). */}
      {[organization, website, software].map((ld, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }}
        />
      ))}
      <ClientLandingPage platformLanding={platformLanding} appName={appName} logoUrl={logoUrl} />
    </>
  )
}
