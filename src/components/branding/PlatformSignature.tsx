import Image from 'next/image'
import { PLATFORM_BRAND_ASSETS } from '@/lib/platform-brand'
import { cn } from '@/lib/utils'

/** The approved signature is an asset, never a typeset approximation. */
export default function PlatformSignature({ tone = 'forest', className = '' }: {
  tone?: 'forest' | 'ivory'
  className?: string
}) {
  return <Image
    src={tone === 'ivory' ? PLATFORM_BRAND_ASSETS.horizontalIvory : PLATFORM_BRAND_ASSETS.horizontalForest}
    alt="Xprout"
    width={902}
    height={314}
    style={{ aspectRatio: '901.8794539094855 / 314.0554789427838' }}
    // Merged so a placement can set its own width without fighting the default.
    className={cn('h-auto w-[177px] min-w-[177px] shrink-0 object-contain sm:w-[195px]', className)}
  />
}
