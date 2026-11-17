'use client'

import Image, { type ImageProps } from 'next/image'
import { useState } from 'react'
import { canOptimizeImage, cardVariantUrl, isManagedImage } from '@/lib/media/image-source'

type DeliveryImageProps = ImageProps & {
  /** `card` uses the small sibling of a stored image (lists, carts, thumbnails); the default is the original. */
  variant?: 'card' | 'full'
}

/**
 * Every menu image goes through here. Stored images come straight from Cloudflare's edge (the card size
 * for lists); local assets and legacy hosts still go through next/image. A card sibling that is not there
 * yet falls back to the original instead of a broken picture.
 */
export function DeliveryImage({ variant = 'full', onError, ...props }: DeliveryImageProps) {
  const src = typeof props.src === 'string' ? props.src : null
  const card = variant === 'card' && src ? cardVariantUrl(src) : null
  const [cardFailed, setCardFailed] = useState(false)
  const useCard = !!card && !cardFailed
  return (
    <Image
      {...props}
      src={useCard ? card : props.src}
      alt={props.alt}
      unoptimized={props.unoptimized || (src !== null && isManagedImage(src)) || !canOptimizeImage(props.src)}
      onError={event => {
        if (useCard) setCardFailed(true)
        else onError?.(event)
      }}
    />
  )
}
