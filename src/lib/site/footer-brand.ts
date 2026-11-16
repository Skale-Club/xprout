import type { ResolvedSite } from './resolve-site'

const PLATFORM_BRAND_ID = '00000000-0000-4000-8000-000000000001'

/** The host's assigned brand controls public attribution, including its opt-out. */
export function siteFooterBrand(site: ResolvedSite | null, platformFooter: string): string {
  if (!site) return ''
  if (site.brand.show_powered_by === false) return ''
  return site.brand.id === PLATFORM_BRAND_ID ? platformFooter : site.brand.name
}
