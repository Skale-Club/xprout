import type { Metadata } from 'next'
import { PLATFORM_SOCIAL_IMAGE } from '@/lib/platform-brand'
import PricingClient from './PricingClient'
import { LAUNCH_SLOTS, PROJECTS, PLANS, formatUsd } from '@/lib/marketing/pricing'
import { getMarketingChrome } from '@/lib/marketing/marketing-chrome'

export const revalidate = 60

const title = 'Pricing — Xprout'
const description = `Menu websites for restaurants: setup from ${formatUsd(PROJECTS.we.launch)}, paid once, and plans from ${formatUsd(PLANS.menu.monthly)}/month. We build it, you approve it, we keep it updated. Launch pricing for our first ${LAUNCH_SLOTS} restaurants.`

export const metadata: Metadata = {
  // Absolute: the title already carries the brand (see the marketing layout).
  title: { absolute: title },
  description,
  alternates: { canonical: '/pricing' },
  openGraph: { title, description, url: '/pricing', type: 'website', images: [{ url: PLATFORM_SOCIAL_IMAGE, width: 1200, height: 630, alt: title }] },
  twitter: { card: 'summary_large_image', title, description, images: [PLATFORM_SOCIAL_IMAGE] },
}

export default async function PricingPage() {
  return <PricingClient {...await getMarketingChrome()} />
}
