import { BRAND_NAME } from '@/lib/brand'
import { DeliveryImage } from '@/components/delivery-image'
import { isDefaultPlatformLogo, platformLogoUrl } from '@/lib/platform-brand'
import { cn } from '@/lib/utils'
import PlatformSignature from './PlatformSignature'

/** The approved signature stands in only for the default Xprout identity; a configured
 *  white-label name or icon keeps its own icon and name. */
export function usesPlatformSignature(appName?: string | null, logoUrl?: string | null): boolean {
  return (appName ?? BRAND_NAME) === BRAND_NAME && isDefaultPlatformLogo(logoUrl)
}

/** Panel placements of the platform brand.
 *  - `header`: sidebar header of the platform's own console. 177px box = 160px visible artwork,
 *    the manual's minimum; the left clear space (4.9% of the artboard) is pulled back so the
 *    artwork lines up with the text below it.
 *  - `bar`: phone top bar. 126px, the same small-screen size as the marketing header, nudged down
 *    so the lettering body (not the p descender) sits on the bar's centre line.
 *  - `credit`: "Powered by" line in a restaurant's panel, where the restaurant's identity leads. */
type Placement = 'header' | 'bar' | 'credit'

const SIGNATURE: Record<Placement, string> = {
  header: 'w-[177px] min-w-[177px] sm:w-[177px] -ml-[9px]',
  bar: 'w-[126px] min-w-[126px] sm:w-[126px] translate-y-[7.7787%]',
  credit: 'w-[126px] min-w-[126px] sm:w-[126px] translate-y-[7.7787%]',
}

const ICON: Record<Placement, { px: number; className: string; text: string }> = {
  header: { px: 24, className: 'size-6 rounded-md', text: 'text-xs font-bold uppercase tracking-[0.2em]' },
  bar: { px: 32, className: 'size-8 rounded-lg', text: 'sr-only' },
  credit: { px: 16, className: 'size-4 rounded', text: 'text-xs font-bold' },
}

export default function PanelPlatformBrand({ appName, logoUrl, tone, placement, className }: {
  appName?: string | null
  logoUrl?: string | null
  tone: 'forest' | 'ivory'
  placement: Placement
  className?: string
}) {
  if (usesPlatformSignature(appName, logoUrl)) {
    return <PlatformSignature tone={tone} className={cn(SIGNATURE[placement], className)} />
  }
  const icon = ICON[placement]
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      <DeliveryImage
        src={platformLogoUrl(logoUrl)}
        width={icon.px}
        height={icon.px}
        sizes={`${icon.px}px`}
        alt=""
        className={cn(icon.className, 'shrink-0 object-contain outline outline-1 -outline-offset-1', tone === 'ivory' ? 'outline-white/10' : 'outline-black/10')}
      />
      <span className={cn('truncate', icon.text)}>{appName ?? BRAND_NAME}</span>
    </span>
  )
}
