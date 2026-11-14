import type { Metadata } from 'next'
import PricingClient from './PricingClient'
import { LAUNCH_SLOTS, PROJECTS, PLANS, formatUsd } from '@/lib/marketing/pricing'
import { createServiceClient } from '@/lib/supabase/server'
import { platformSettingsOwned } from '@/lib/data/platform-settings'
import type { FooterData } from '@/components/marketing/MarketingChrome'

export const revalidate = 60

const title = 'Pricing — Xprout'
const description = `Menu websites for restaurants from ${formatUsd(PROJECTS.diy.launch)} and plans from ${formatUsd(PLANS.menu.monthly)}/month. We build it, you approve it, we keep it updated. Launch pricing for our first ${LAUNCH_SLOTS} restaurants.`

export const metadata: Metadata = {
  // Absolute: the title already carries the brand (see the marketing layout).
  title: { absolute: title },
  description,
  alternates: { canonical: '/pricing' },
  openGraph: { title, description, url: '/pricing', type: 'website', images: [{ url: '/opengraph-image?v=xprout-v1', width: 1200, height: 630, alt: title }] },
  twitter: { card: 'summary_large_image', title, description, images: ['/opengraph-image?v=xprout-v1'] },
}

async function getPricingBrand() {
  try {
    let settings: { app_name: string | null; favicon_url: string | null; landing: unknown } | null
    if (platformSettingsOwned()) {
      const { readOwnedPlatformSettings } = await import('@/lib/data/platform-settings-runtime')
      settings = await readOwnedPlatformSettings(['app_name', 'favicon_url', 'landing']) as typeof settings
    } else {
      const service = createServiceClient()
      settings = (await service.from('platform_settings').select('app_name, favicon_url, landing').single()).data
    }
    const landing = settings?.landing && typeof settings.landing === 'object' ? settings.landing as { footer?: FooterData } : null
    return { appName: settings?.app_name ?? null, logoUrl: settings?.favicon_url ?? null, footerData: landing?.footer ?? null }
  } catch {
    // An owned-source failure uses the defaults, never a legacy database fallback.
    return { appName: null, logoUrl: null, footerData: null }
  }
}

export default async function PricingPage() {
  return <PricingClient {...await getPricingBrand()} />
}
