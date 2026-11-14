import LandingPage from './(marketing)/page'
import { PlatformTagManager } from '@/components/tracking/PlatformTagManager'
import MarketingFrame from '@/components/marketing/MarketingFrame'

// "/" renders the marketing landing under the root layout, so the marketing
// layout's Tag Manager and route config do not apply here: declare both.
export const revalidate = 60

export default async function RootLandingPage() {
  return (
    <MarketingFrame>
      <PlatformTagManager />
      <LandingPage />
    </MarketingFrame>
  )
}
