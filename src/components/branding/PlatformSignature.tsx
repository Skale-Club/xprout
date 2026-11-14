import Image from 'next/image'
import { PLATFORM_BRAND_ASSETS } from '@/lib/platform-brand'

/** The approved signature is an asset, never a typeset approximation. */
export default function PlatformSignature({ tone = 'forest', className = '' }: {
  tone?: 'forest' | 'ivory'
  className?: string
}) {
  return <Image
    src={tone === 'ivory' ? PLATFORM_BRAND_ASSETS.horizontalIvory : PLATFORM_BRAND_ASSETS.horizontalForest}
    alt="Xprout"
    width={1064}
    height={320}
    style={{ aspectRatio: '1064.1543518142191 / 320.0414858022277' }}
    className={`h-auto w-[177px] min-w-[177px] shrink-0 object-contain sm:w-[195px] ${className}`}
  />
}
