'use client'

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { Pause, Play } from 'lucide-react'

const preferenceKey = 'xprout.marketing.motion.v1'
const preferenceEvent = 'xprout-marketing-motion'
type MotionPreference = 'playing' | 'paused' | 'reduced'
let sessionPreference: 'playing' | 'paused' | undefined

function snapshot(): MotionPreference {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return 'reduced'
  if (sessionPreference) return sessionPreference
  try { return localStorage.getItem(preferenceKey) === 'paused' ? 'paused' : 'playing' }
  catch { return 'playing' }
}

function subscribe(notify: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  const storage = (event: StorageEvent) => { if (event.key === preferenceKey) { sessionPreference = undefined; notify() } }
  media.addEventListener('change', notify)
  window.addEventListener('storage', storage)
  window.addEventListener(preferenceEvent, notify)
  return () => {
    media.removeEventListener('change', notify)
    window.removeEventListener('storage', storage)
    window.removeEventListener(preferenceEvent, notify)
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

  const toggle = () => {
    sessionPreference = playing ? 'paused' : 'playing'
    try { localStorage.setItem(preferenceKey, sessionPreference) } catch { /* Session preference still works. */ }
    window.dispatchEvent(new Event(preferenceEvent))
  }
  const label = playing ? 'Pause motion' : 'Resume motion'
  return <div ref={root} data-motion={playing ? 'on' : 'off'} className="mk-motion-surface">
    <div aria-hidden="true" className="mk-scroll-progress" />
    {children}
    {preference !== 'reduced' ? <button type="button" onClick={toggle} className="mk-motion-toggle" aria-label={label} aria-pressed={!playing} title={label}>
      {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}<span>{label}</span>
    </button> : null}
  </div>
}
