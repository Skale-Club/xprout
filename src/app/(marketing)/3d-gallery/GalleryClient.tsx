'use client'

/*
 * The 3D gallery: a sales tool we open on our own phone or tablet at a
 * restaurant. Categories are an accordion; an open category shows its dishes
 * three across on a phone. A dish opens the viewer: on a computer it turns in
 * the page; on a phone the menu's own AR button places it on the table at its
 * real size (WebXR on Android, Quick Look on iPhone), and inside the Android
 * camera you can step through every gallery dish.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Box, ChevronDown, X } from 'lucide-react'
import PlatformSignature from '@/components/branding/PlatformSignature'
import { DeliveryImage } from '@/components/delivery-image'
import ModelViewer from '@/components/ar/ModelViewer'
import ArButton, { useIsComputer, type ArSequenceItem } from '@/components/ar/ArButton'
import type { GallerySection, PublishedGalleryDish } from '@/lib/marketing/3d-gallery'

const THEME = { primary: '#283f32', accent: '#602021' }
const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mk-wine)]'

function arModel(dish: PublishedGalleryDish) {
  return { glb_url: dish.glb, usdz_url: dish.usdz, real_scale: true, scale: 1 }
}

const sizeLabel = (dish: PublishedGalleryDish) => `${Math.round(dish.widthCm)} cm`

export default function GalleryClient({ sections }: { sections: GallerySection[] }) {
  const dishes = useMemo(() => sections.flatMap(section => section.dishes), [sections])
  const categoryOf = useMemo(() => new Map(sections.flatMap(section => section.dishes.map(dish => [dish.id, section.name] as const))), [sections])
  // The first category starts open, so the page never opens empty.
  const [openSections, setOpenSections] = useState<ReadonlySet<string>>(() => new Set(sections[0] ? [sections[0].id] : []))
  const [openId, setOpenId] = useState<string | null>(null)
  const lastTrigger = useRef<HTMLElement | null>(null)

  const toggle = (id: string) => setOpenSections(previous => {
    const next = new Set(previous)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const allOpen = openSections.size === sections.length

  const open = useCallback((id: string, trigger: HTMLElement) => {
    lastTrigger.current = trigger
    setOpenId(id)
  }, [])
  const close = useCallback(() => {
    setOpenId(null)
    lastTrigger.current?.focus()
  }, [])

  const index = openId ? dishes.findIndex(dish => dish.id === openId) : -1
  const current = index >= 0 ? dishes[index] : null

  return (
    <div className="min-h-[100dvh] bg-[var(--mk-paper)] text-[var(--mk-ink)]">
      <header className="sticky top-0 z-40 bg-[var(--mk-forest)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="Xprout home" className={`shrink-0 rounded-md ${focusRing}`}>
            <PlatformSignature tone="ivory" className="!w-[118px] !min-w-[118px]" />
          </Link>
          <button
            type="button"
            onClick={() => setOpenSections(allOpen ? new Set() : new Set(sections.map(section => section.id)))}
            className={`min-h-11 rounded-full px-3 text-[13px] font-semibold text-[var(--mk-paper)] hover:bg-[#f3efe514] ${focusRing}`}
          >
            {allOpen ? 'Close all' : 'Open all'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 pb-[max(2rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pt-5">
        <ul className="grid gap-2.5">
          {sections.map(section => {
            const expanded = openSections.has(section.id)
            return (
              <li key={section.id} className="overflow-hidden rounded-2xl border border-[var(--mk-line)] bg-[var(--mk-panel)]">
                <h2>
                  <button
                    type="button"
                    id={`${section.id}-toggle`}
                    aria-expanded={expanded}
                    aria-controls={`${section.id}-panel`}
                    onClick={() => toggle(section.id)}
                    className={`flex min-h-14 w-full items-center gap-3 px-4 text-left ${focusRing}`}
                  >
                    {/* Fixed width, so every category name starts at the same place. */}
                    <span className="flex w-20 shrink-0 -space-x-2" aria-hidden="true">
                      {section.dishes.slice(0, 3).map(dish => (
                        <span key={dish.id} className="relative size-8 overflow-hidden rounded-full ring-2 ring-[var(--mk-panel)]">
                          <DeliveryImage src={dish.photo} alt="" fill sizes="32px" className="object-cover" />
                        </span>
                      ))}
                    </span>
                    <span className="flex-1 font-[family-name:var(--font-marketing-display)] text-[19px] font-semibold leading-tight tracking-[-0.02em] sm:text-[22px]">
                      {section.name}
                    </span>
                    <ChevronDown className={`size-5 shrink-0 text-[var(--mk-muted)] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                </h2>
                {expanded && (
                  <div id={`${section.id}-panel`} role="region" aria-labelledby={`${section.id}-toggle`} className="px-2.5 pb-3 sm:px-4 sm:pb-4">
                    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
                      {section.dishes.map(dish => (
                        <li key={dish.id}><DishCard dish={dish} onOpen={open} /></li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </main>

      {current && (
        <DishViewer
          key={current.id}
          dish={current}
          category={categoryOf.get(current.id) ?? ''}
          dishes={dishes}
          onClose={close}
          onStep={step => setOpenId(dishes[(index + step + dishes.length) % dishes.length].id)}
        />
      )}
    </div>
  )
}

function DishCard({ dish, onOpen }: { dish: PublishedGalleryDish; onOpen: (id: string, trigger: HTMLElement) => void }) {
  return (
    <button
      type="button"
      onClick={event => onOpen(dish.id, event.currentTarget)}
      aria-label={`${dish.name}: view in 3D`}
      className={`group block w-full rounded-xl text-left ${focusRing}`}
    >
      <span className="relative block aspect-square overflow-hidden rounded-xl bg-[var(--mk-paper)]">
        <DeliveryImage
          src={dish.photo}
          alt=""
          fill
          sizes="(min-width: 1024px) 180px, (min-width: 640px) 24vw, 32vw"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
        />
        <span className="absolute bottom-1.5 left-1.5 flex size-6 items-center justify-center rounded-full bg-[#14271dcc] text-[var(--mk-paper)] backdrop-blur-sm">
          <Box className="size-3.5" aria-hidden="true" />
        </span>
      </span>
      <span className="mt-1.5 line-clamp-2 block px-0.5 text-[12px] font-semibold leading-[1.25] sm:text-[13px]">{dish.name}</span>
    </button>
  )
}

function DishViewer({ dish, category, dishes, onClose, onStep }: {
  dish: PublishedGalleryDish
  category: string
  dishes: PublishedGalleryDish[]
  onClose: () => void
  onStep: (step: 1 | -1) => void
}) {
  const computer = useIsComputer()
  const closeButton = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDivElement>(null)

  useEffect(() => {
    closeButton.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflow }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowRight') onStep(1)
      else if (event.key === 'ArrowLeft') onStep(-1)
      else if (event.key === 'Tab' && dialog.current) {
        // Keep focus inside the dialog.
        const focusable = dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onStep])

  const sequence = useMemo(() => ({
    startId: dish.id,
    items: dishes.map((item): ArSequenceItem => ({ id: item.id, name: item.name, model: arModel(item), priceLabel: sizeLabel(item) })),
  }), [dish.id, dishes])

  const stepButton = `flex size-11 shrink-0 items-center justify-center rounded-full border border-[var(--mk-line)] bg-[var(--mk-panel)] text-[var(--mk-ink)] transition-colors hover:border-[var(--mk-forest)] ${focusRing}`

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#14271db3] backdrop-blur-sm md:items-center md:p-6" onClick={onClose}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-dish-title"
        onClick={event => event.stopPropagation()}
        className="relative grid max-h-[100dvh] w-full overflow-y-auto rounded-t-[28px] bg-[var(--mk-paper)] shadow-[0_30px_80px_#14271d55] md:max-w-5xl md:grid-cols-[1.35fr_1fr] md:overflow-hidden md:rounded-[28px]"
      >
        <div className="relative aspect-square w-full bg-[radial-gradient(circle_at_50%_40%,#fbf8f0_0%,#e7e2d4_100%)] md:aspect-auto md:min-h-[560px]">
          <ModelViewer
            src={dish.glb}
            iosSrc={dish.usdz}
            alt={`${dish.name} in 3D`}
            realScale
            ar={false}
            arLabel="See it on your table"
            cameraOrbit="20deg 58deg auto"
            className="absolute inset-0 size-full"
          />
          <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs font-medium text-[var(--mk-muted)]">
            {computer ? 'Drag to turn · scroll to zoom' : 'Drag to turn'}
          </p>
        </div>

        <div className="flex flex-col gap-5 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:p-9">
          <div className="grid gap-2 pr-12 md:pr-0">
            <p className="mk-eyebrow">{category}</p>
            <h2 id="gallery-dish-title" className="font-[family-name:var(--font-marketing-display)] text-[clamp(26px,3vw,40px)] font-semibold leading-[1.08] tracking-[-0.03em]">
              {dish.name}
            </h2>
            <p className="text-[15px] text-[var(--mk-muted)]">Real size: {sizeLabel(dish)} wide</p>
          </div>

          <ArButton
            model={arModel(dish)}
            name={dish.name}
            lang="en"
            theme={THEME}
            sequence={sequence}
            className="mk-button w-full gap-2 text-[15px]"
          />

          <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--mk-line)] pt-4">
            <button type="button" onClick={() => onStep(-1)} aria-label="Previous dish" className={stepButton}><ArrowLeft className="size-[18px]" aria-hidden="true" /></button>
            <button type="button" onClick={() => onStep(1)} aria-label="Next dish" className={stepButton}><ArrowRight className="size-[18px]" aria-hidden="true" /></button>
          </div>
        </div>

        <button
          ref={closeButton}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={`absolute right-4 top-4 z-10 flex size-11 items-center justify-center rounded-full bg-[#14271dcc] text-[var(--mk-paper)] backdrop-blur-sm ${focusRing}`}
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
