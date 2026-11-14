'use client'

import { useState } from 'react'
import { ArrowRight, ArrowUpRight, BookOpen } from 'lucide-react'
import { DeliveryImage } from '@/components/delivery-image'

const examples = [
  {
    name: 'Aurora', category: 'Kitchen & bar', href: '/aurora',
    title: 'A closer look, before the first bite.',
    description: 'Explore Aurora’s photo feed and dish details, then turn selected dishes in 3D to see them from every angle.',
    image: '/marketing/v2/menu-aurora.webp',
    alt: 'Captured guest menu for Aurora Kitchen & Bar, showing its list of dishes',
    label: 'Aurora Kitchen & Bar',
  },
  {
    name: 'Bella Vista', category: 'Italian restaurant', href: '/bella-vista',
    title: 'Let the food do the talking.',
    description: 'Browse an Italian menu with generous dish photography and the detail guests want before they choose.',
    image: '/marketing/v2/menu-bella-vista.webp',
    alt: 'Captured guest menu for Bella Vista, showing its list of Italian dishes',
    label: 'Bella Vista',
  },
  {
    name: 'Celes', category: 'Confections', href: '/celes',
    title: 'Save a little room for something sweet.',
    description: 'See a different expression of the same platform: a confectionery menu made around its own food and identity.',
    image: '/marketing/v2/menu-celes.webp',
    alt: 'Captured guest menu for Celes Confections, showing its photo feed',
    label: 'Celes Confections',
  },
] as const

/** Real, optional destinations rather than a simulated checkout or embedded app. */
export default function MenuShowcase() {
  const [selected, setSelected] = useState(0)
  const example = examples[selected]

  return <section id="experience" className="mk-experience mk-section scroll-mt-24" aria-labelledby="examples-title">
    <div className="mk-container">
      <div className="mb-8 grid gap-6 md:mb-12 md:grid-cols-[1.2fr_1fr] md:items-end">
        <div>
          <p className="mk-eyebrow mb-4">Explore the experience</p>
          <h2 id="examples-title" className="mk-h2 max-w-xl">See how a menu can feel.</h2>
        </div>
        <p className="mk-lead max-w-md md:justify-self-end">Move from the photo feed to dish details, with selected dishes to explore in 3D. See how each restaurant brings its own food and character to the menu.</p>
      </div>

      <div role="group" aria-label="Choose a menu example" className="mb-6 flex flex-wrap gap-2">
        {examples.map((item, index) => <button key={item.name} type="button" aria-pressed={selected === index}
          onClick={() => setSelected(index)}
          className={`mk-example-choice min-h-12 rounded-full border px-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--mk-wine)] ${selected === index ? 'border-[var(--mk-wine)] bg-[var(--mk-wine)] text-[var(--mk-paper)]' : 'border-[var(--mk-line)] bg-transparent text-[var(--mk-ink)] hover:bg-[var(--mk-panel)]'}`}>
          {item.name}
        </button>)}
      </div>

      <div data-example={selected} className="mk-showcase-stage grid overflow-hidden rounded-3xl border border-[var(--mk-line)] bg-[var(--mk-panel)] md:grid-cols-2">
        <figure className="m-0 flex min-w-0 flex-col items-center justify-center gap-6 bg-[color-mix(in_srgb,var(--mk-forest)_8%,var(--mk-paper))] p-6 sm:p-10">
          <p className="mk-eyebrow text-center">Guest menu preview</p>
          <div key={example.image} className="mk-phone-swap w-full max-w-[240px] overflow-hidden rounded-[32px] border-[6px] border-[var(--mk-forest)] bg-[var(--mk-forest)] shadow-[0_16px_36px_rgb(20_39_29_/_0.15)]">
            <DeliveryImage src={example.image} alt={example.alt} width={390} height={844}
              sizes="(max-width: 359px) 220px, 240px" className="h-auto w-full" />
          </div>
          <figcaption className="text-center text-sm text-[var(--mk-ink)]">
            <span className="block font-semibold">{example.label}</span>
            <span className="mk-muted mt-1 block text-xs tabular-nums">Preview / {String(selected + 1).padStart(2, '0')} of {String(examples.length).padStart(2, '0')}</span>
            <span className="mk-muted mt-1 block text-xs">A captured preview. Open the menu to explore.</span>
          </figcaption>
        </figure>
        <div className="flex min-w-0 flex-col justify-center p-6 sm:p-10 lg:p-14">
          <div aria-live="polite" aria-atomic="true"><div key={example.name} className="mk-copy-swap">
            <p className="mk-eyebrow mb-5">{example.category} · Menu example</p>
            <h3 className="mk-h2 mb-5">{example.title}</h3>
            <p className="mk-lead mb-8">{example.description}</p>
          </div></div>
          <a href={example.href} target="_blank" rel="noopener noreferrer" className="mk-button w-full sm:w-fit">
            Open {example.name} <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
            <span className="sr-only"> menu in a new tab</span>
          </a>
          <a href={`${example.href}?view=feed`} target="_blank" rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold underline decoration-[var(--mk-line)] underline-offset-4">
            Explore the photo feed <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
            <span className="sr-only"> in a new tab</span>
          </a>
          <p className="mk-muted mt-4 text-sm leading-relaxed">3D is available for dishes with a model. Camera viewing requires a supported phone.</p>
          <div className="mt-10 flex items-start gap-3 border-t border-[var(--mk-line)] pt-6">
            <BookOpen className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p className="mk-muted text-sm leading-relaxed">These are live examples to explore. Menu content and available ordering options depend on each restaurant.</p>
          </div>
        </div>
      </div>
      <a href="#how-it-works" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline decoration-[var(--mk-line)] underline-offset-4">
        A menu like this, made for your restaurant <ArrowRight className="size-4" aria-hidden="true" />
      </a>
    </div>
  </section>
}
