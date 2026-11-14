'use client'

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
type MotionPreference = 'playing' | 'reduced'

function snapshot(): MotionPreference {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return 'reduced'
  return 'playing'
}

function subscribe(notify: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', notify)
  return () => {
    media.removeEventListener('change', notify)
  }
}

export function useMarketingMotionPreference() {
  return useSyncExternalStore(subscribe, snapshot, () => 'reduced' as const)
}

/** Progressive enhancement: SSR and reduced-motion visitors always see all content. */
export default function MarketingMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  const preference = useMarketingMotionPreference()
  const playing = preference === 'playing'

  useEffect(() => {
    const surface = root.current
    if (!surface) return
    const sections = surface.querySelectorAll<HTMLElement>('section.mk-section')
    if (!playing || !('IntersectionObserver' in window)) {
      sections.forEach(section => { delete section.dataset.reveal })
      return
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).dataset.reveal = 'shown'
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: .025, rootMargin: '0px 0px -24px 0px' })
    sections.forEach(section => {
      if (section.dataset.reveal === 'shown' || section.getBoundingClientRect().top < innerHeight + 24) {
        section.dataset.reveal = 'shown'
      } else { section.dataset.reveal = 'pending'; observer.observe(section) }
    })
    const revealFocus = (event: FocusEvent) => {
      const section = (event.target as HTMLElement).closest<HTMLElement>('[data-reveal]')
      if (section) { section.dataset.reveal = 'shown'; observer.unobserve(section) }
    }
    surface.addEventListener('focusin', revealFocus)
    return () => { observer.disconnect(); surface.removeEventListener('focusin', revealFocus) }
  }, [playing])

  return <div ref={root} data-motion={playing ? 'on' : 'off'} className="mk-motion-surface">
    {children}
  </div>
}
