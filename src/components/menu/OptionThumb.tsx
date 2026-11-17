import { DeliveryImage } from '@/components/delivery-image'
import { optionPhotoUrl } from '@/lib/menu/option-images'

/** The small rounded photo of an option choice; nothing at all when the choice has none. */
export default function OptionThumb({ option }: { option: { image_url?: string | null } }) {
  const src = optionPhotoUrl(option)
  if (!src) return null
  return (
    <span aria-hidden="true" className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
      <DeliveryImage variant="card" src={src} alt="" fill sizes="40px" loading="lazy" draggable={false} className="object-cover" />
    </span>
  )
}
