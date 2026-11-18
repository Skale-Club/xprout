import { getPublicLocale } from '@/lib/marketing/public-locale-server'
import { translatePublic } from '@/lib/marketing/public-translate'
import { publicAlternates, publicIntlLocale } from '@/lib/marketing/public-locale'
import type { Metadata } from 'next'
import { PLATFORM_SOCIAL_IMAGE } from '@/lib/platform-brand'
import PricingClient from './PricingClient'
import { LAUNCH_SLOTS, PROJECTS, PLANS, formatUsd } from '@/lib/marketing/pricing'
import { getMarketingChrome } from '@/lib/marketing/marketing-chrome'

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getPublicLocale()
  const title = `${translatePublic(locale, 'Pricing')} — Xprout`
  const description = translatePublic(locale, 'Menu websites for restaurants: setup from {setup}, paid once, and plans from {plan}/month. We build it, you approve it, we keep it updated. Launch pricing for our first {slots} restaurants.', { setup: formatUsd(PROJECTS.we.launch, locale), plan: formatUsd(PLANS.menu.monthly, locale), slots: LAUNCH_SLOTS })
  return {
    title: { absolute: title }, description, alternates: publicAlternates('/pricing', locale),
    openGraph: { title, description, url: '/pricing', type: 'website', locale: publicIntlLocale(locale).replace('-', '_'), images: [{ url: PLATFORM_SOCIAL_IMAGE, width: 1200, height: 630, alt: title }] },
    twitter: { card: 'summary_large_image', title, description, images: [PLATFORM_SOCIAL_IMAGE] },
  }
}

export default async function PricingPage() {
  return <PricingClient {...await getMarketingChrome()} />
}
