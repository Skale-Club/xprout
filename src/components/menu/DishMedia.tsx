'use client'

import { useState } from 'react'
import { Box, Image as ImageIcon } from 'lucide-react'
import { DeliveryImage } from '@/components/delivery-image'
import ModelViewer from '@/components/ar/ModelViewer'
import ArButton, { useIsComputer } from '@/components/ar/ArButton'
import { getArCopy } from '@/components/ar/ar-copy'
import type { PublicProductArModel } from '@/types/database'

/**
 * A dish page's picture: the photo, and when the dish has a model, its 3D view in the same frame
 * (turn it with the mouse or a finger) plus the phone's "see it on your table" camera.
 */
export default function DishMedia({ name, photo, arModel, lang, primary, accent }: {
  name: string
  photo: string
  arModel: PublicProductArModel | null
  lang: string
  /** The restaurant's colours, for the camera's buttons. */
  primary: string
  accent: string
}) {
  const [showing3d, setShowing3d] = useState(false)
  const computer = useIsComputer()
  const copy = getArCopy(lang)
  const pill = 'inline-flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-semibold shadow-sm transition-[scale,background-color] active:scale-95'

  return (
    <div className="grid gap-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-zinc-100 shadow-card ring-1 ring-black/5">
        {showing3d && arModel ? (
          <>
            <ModelViewer key={arModel.glb_url} src={arModel.glb_url} iosSrc={arModel.usdz_url} alt={name} realScale={arModel.real_scale}
              arLabel={copy.viewOnTable} ar={false} cameraOrbit="20deg 58deg auto" className="absolute inset-0 size-full bg-gradient-to-b from-zinc-50 to-zinc-200" />
            {computer && <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-xs font-medium text-zinc-500">{copy.turnHint}</p>}
          </>
        ) : (
          <DeliveryImage src={photo} alt={name} width={900} height={900} sizes="(max-width: 767px) calc(100vw - 40px), 450px" className="size-full object-cover" priority />
        )}
        {arModel && (
          <button type="button" onClick={() => setShowing3d(value => !value)} aria-pressed={showing3d}
            className={`${pill} absolute left-4 top-4 bg-white/95 text-zinc-900 hover:bg-white`}>
            {showing3d ? <ImageIcon className="size-4" aria-hidden="true" /> : <Box className="size-4" aria-hidden="true" />}
            {showing3d ? copy.viewPhoto : copy.view3d}
          </button>
        )}
      </div>
      {/* Phones with an AR camera: the dish on the guest's own table, at its real size. */}
      {arModel && (
        <ArButton model={arModel} name={name} lang={lang} theme={{ primary, accent }}
          className={`${pill} w-full justify-center bg-primary text-primary-foreground`} />
      )}
    </div>
  )
}
