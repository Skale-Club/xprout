import { createServiceClient } from '@/lib/supabase/server'
import { platformSettingsOwned } from '@/lib/data/platform-settings'
import type { FooterData } from '@/components/marketing/MarketingChrome'

export interface MarketingChromeData {
  appName: string | null
  logoUrl: string | null
  footerData: FooterData | null
}

/** The platform name, logo and footer copy the shared marketing header and footer draw with. */
export async function getMarketingChrome(): Promise<MarketingChromeData> {
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
