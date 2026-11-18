'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { DeliveryImage } from '@/components/delivery-image'
import { useMarketingMotionPreference } from './MarketingMotion'
import { usePublicLocale } from './PublicLocale'

const examples = [
  {
    // The demo store is Aurora; /demo redirects to it (src/app/demo/route.ts).
    category: 'Photo-led menu', href: '/demo',
    title: 'A closer look, before the first bite.',
    description: 'Browse a photo-led menu and open the dish details, with selected dishes to explore from every angle in 3D.',
    image: '/marketing/v3/demo-photo-menu.webp',
    alt: 'Illustrative photo feed showing a dish, description and price',
  },
  {
    category: 'Italian menu', href: '/bella-vista',
    title: 'Let the food do the talking.',
    description: 'Browse an Italian menu with generous dish photography and the detail guests want before they choose.',
    image: '/marketing/v3/demo-italian-menu.webp',
    alt: 'Illustrative Italian menu showing a pasta dish in the photo feed',
  },
  {
    // Celes is a real prospect, not a demo: this example opens the demo store instead.
    category: 'Dessert feed', href: '/demo',
    title: 'Save a little room for something sweet.',
    description: 'See a different expression of the same platform: a confectionery menu made around its own food and identity.',
    image: '/marketing/v3/demo-dessert-feed.webp',
    alt: 'Illustrative dessert feed showing a full-screen dish photograph',
  },
] as const

/** Real, optional destinations rather than a simulated checkout or embedded app. */
export default function MenuShowcase() {
  const { t, href } = usePublicLocale()
  // An endless turn: `position` only ever counts up or down; the menu in front is position mod 3.
  const [position, setPosition] = useState(0)
  const count = examples.length
  const selected = ((position % count) + count) % count
  const example = examples[selected]
  const motion = useMarketingMotionPreference()
  const stage = useRef<HTMLDivElement>(null)
  const [stageWidth, setStageWidth] = useState(480)
  const [drag, setDrag] = useState<{ start: number; x: number } | null>(null)
  const [hovered, setHovered] = useState(false)
  const [manual, setManual] = useState(false)

  useEffect(() => {
    const element = stage.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setStageWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // A slow turn on its own until someone takes over (hover, drag, a choice).
  useEffect(() => {
    if (motion !== 'playing' || hovered || drag || manual) return
    const timer = setTimeout(() => setPosition(current => current + 1), 5000)
    return () => clearTimeout(timer)
  }, [motion, hovered, drag, manual, position])

  const turnTo = (next: number) => { setManual(true); setPosition(next) }
  // Relative turns add up even when several land before a render (fast keys).
  const turnBy = (steps: number) => { setManual(true); setPosition(current => current + steps) }
  // Distance between the front phone and the ones behind it, from the room the stage has.
  const step = Math.max(80, Math.min(170, stageWidth / 2 - 70))
  const shift = drag ? Math.max(-1, Math.min(1, (drag.x - drag.start) / step)) : 0

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({ start: event.clientX, x: event.clientX })
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag) setDrag({ ...drag, x: event.clientX })
  }
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag) return
    const moved = event.clientX - drag.start
    setDrag(null)
    if (Math.abs(moved) < 6) {
      // A tap on a phone behind brings it to the front.
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-phone]')
      if (target) turnTo(Number(target.dataset.phone))
      return
    }
    if (Math.abs(moved) > step * 0.25) turnBy(moved < 0 ? 1 : -1)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); turnBy(1) }
    if (event.key === 'ArrowLeft') { event.preventDefault(); turnBy(-1) }
  }
  // Five slots around the front (-2..2): the outer two are invisible, so a phone leaves on one
  // side while the next one comes in on the other, forever, without crossing the front.
  const slots = [-2, -1, 0, 1, 2].map(slot => position + slot)

  return <section id="demo-store" className="mk-experience mk-section scroll-mt-24" aria-labelledby="examples-title">
    <div id="experience" className="mk-container">
      <div className="mb-8 grid gap-6 md:mb-12 md:grid-cols-[1.2fr_1fr] md:items-end">
        <div>
          <p className="mk-eyebrow mb-4">{t('Try Xprout')}</p>
          <h2 id="examples-title" className="mk-h2 max-w-xl">{t('Visit the demo store.')}</h2>
        </div>
        <p className="mk-lead max-w-md md:justify-self-end">{t('Browse a complete menu and open selected dishes in 3D. Choose a demonstration to try the guest experience.')}</p>
      </div>


      <div data-example={selected} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} className="mk-showcase-stage grid overflow-hidden rounded-3xl border border-[var(--mk-line)] bg-[var(--mk-panel)] md:grid-cols-2">
        <figure className="m-0 flex min-w-0 flex-col items-center justify-center gap-6 bg-[color-mix(in_srgb,var(--mk-forest)_8%,var(--mk-paper))] p-6 sm:p-10">
          <p className="mk-eyebrow text-center">{t('Guest menu preview')}</p>
          {/* The chosen menu in front, the other two behind it; drag, tap a phone or use the arrow keys. */}
          <div ref={stage} role="group" aria-roledescription={t('carousel')} aria-label={t('Menu examples, use the arrow keys to turn')} tabIndex={0}
            className={`mk-phone-carousel ${drag ? 'is-dragging' : ''}`}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => setDrag(null)} onKeyDown={onKeyDown}>
            {slots.map(virtual => {
              const item = examples[((virtual % count) + count) % count]
              // -1 left, 0 front, 1 right (±2 hidden just outside), moved along while dragging.
              const offset = virtual - position + shift
              const distance = Math.min(2, Math.abs(offset))
              const depth = Math.min(1, distance)
              const front = virtual === position
              return <div key={virtual} data-phone={virtual} aria-hidden={!front}
                className="mk-phone-card w-[min(210px,54%)] overflow-hidden rounded-[32px] border-[6px] border-[var(--mk-forest)] bg-[var(--mk-forest)]"
                style={{
                  transform: `translateX(${offset * step}px) rotateY(${Math.max(-2, Math.min(2, offset)) * -16}deg) scale(${1 - distance * 0.16})`,
                  zIndex: 10 - Math.round(distance * 4),
                  opacity: Math.max(0, Math.min(1, 2 - distance)),
                  filter: `brightness(${1 - depth * 0.18}) saturate(${1 - depth * 0.25})`,
                  transition: drag ? 'none' : undefined,
                }}>
                <DeliveryImage src={item.image} alt={front ? t(item.alt) : ''} width={390} height={844} draggable={false}
                  sizes="210px" className="pointer-events-none h-auto w-full select-none" />
              </div>
            })}
          </div>
        </figure>
        <div className="flex min-w-0 flex-col justify-center p-6 sm:p-10 lg:p-14">
          <div aria-live="polite" aria-atomic="true"><div key={example.category} className="mk-copy-swap">
            <p className="mk-eyebrow mb-5">{t('{category} · Demo', { category: t(example.category) })}</p>
            <h3 className="mk-h2 mb-5">{t(example.title)}</h3>
            <p className="mk-lead mb-8">{t(example.description)}</p>
          </div></div>
          <a href={href(example.href)} target="_blank" rel="noopener noreferrer" className="mk-button w-full sm:w-fit">
            {t('Visit the demo store')}{' '}<ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">{' '}{t('(opens in a new tab)')}</span>
          </a>
        </div>
      </div>
    </div>
  </section>
}
