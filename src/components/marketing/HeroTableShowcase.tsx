'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { DeliveryImage } from '@/components/delivery-image'
import { useMarketingMotionPreference } from './MarketingMotion'
import HeroDishARButton from './HeroDishARButton'

const dishes = [
  { id: 'picanha', name: 'Premium Picanha', category: 'Main' },
  { id: 'burger', name: 'Artisan Burger', category: 'Main' },
  { id: 'tiramisu', name: 'Tiramisu', category: 'Dessert' },
] as const

/** One photographed table, one active dish model, and a matching transparent poster. */
export default function HeroTableShowcase() {
  const motion = useMarketingMotionPreference()
  const root = useRef<HTMLDivElement>(null)
  const viewer = useRef<HTMLElement>(null)
  const [selected, setSelected] = useState(0)
  const [visible, setVisible] = useState(false)
  const [activeDocument, setActiveDocument] = useState(true)
  const [idle, setIdle] = useState(false)
  const [explicit, setExplicit] = useState(false)
  const [libraryReady, setLibraryReady] = useState(false)
  const [loaded, setLoaded] = useState('')
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [manual, setManual] = useState(false)
  const [manipulatedModel, setManipulatedModel] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const dish = dishes[selected]
  const source = `/marketing/v3/dish-${dish.id}`
  const modelSource = `${source}.glb${retry > 0 ? `?retry=${retry}` : ''}`
  const modelKey = `${dish.id}-${retry}`
  const enabled = explicit || (idle && motion !== 'reduced')
  const ready = loaded === modelKey

  useEffect(() => {
    const element = root.current
    if (!element) return
    if (typeof globalThis.IntersectionObserver === 'undefined') {
      const updateVisibility = () => {
        const bounds = element.getBoundingClientRect()
        setVisible(bounds.bottom > 0 && bounds.top < window.innerHeight)
      }
      updateVisibility()
      window.addEventListener('scroll', updateVisibility, { passive: true })
      window.addEventListener('resize', updateVisibility)
      return () => {
        window.removeEventListener('scroll', updateVisibility)
        window.removeEventListener('resize', updateVisibility)
      }
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .15 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const update = () => setActiveDocument(document.visibilityState === 'visible')
    update()
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let idleHandle: number | undefined
    const schedule = () => {
      if ('requestIdleCallback' in window) idleHandle = window.requestIdleCallback(() => setIdle(true), { timeout: 4000 })
      else timer = setTimeout(() => setIdle(true), 1200)
    }
    if (document.readyState === 'complete') schedule()
    else window.addEventListener('load', schedule, { once: true })
    return () => {
      window.removeEventListener('load', schedule)
      if (timer) clearTimeout(timer)
      if (idleHandle !== undefined) window.cancelIdleCallback(idleHandle)
    }
  }, [])

  useEffect(() => {
    if (!enabled || !visible || !activeDocument || libraryReady) return
    let cancelled = false
    import('@google/model-viewer').then(() => {
      if (!cancelled) setLibraryReady(true)
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [enabled, visible, activeDocument, libraryReady, retry])

  useEffect(() => {
    const element = viewer.current
    if (!element || !enabled || !libraryReady) return
    const onLoad = () => {
      ;(element as HTMLElement & { jumpCameraToGoal?: () => void }).jumpCameraToGoal?.()
      setLoaded(modelKey); setFailed(false); clearTimeout(timeout)
    }
    const onError = () => { setFailed(true); clearTimeout(timeout) }
    const timeout = setTimeout(onError, 30000)
    element.addEventListener('load', onLoad)
    element.addEventListener('error', onError)
    return () => {
      clearTimeout(timeout)
      element.removeEventListener('load', onLoad)
      element.removeEventListener('error', onError)
    }
  }, [enabled, libraryReady, modelKey])

  useEffect(() => {
    const element = viewer.current as (HTMLElement & { pause?: () => void }) | null
    if (!element) return
    const onCameraChange = (event: Event) => {
      // model-viewer 4.4 reports scripted camera changes as a different source.
      if ((event as CustomEvent<{ source?: string }>).detail?.source !== 'user-interaction') return
      element.pause?.()
      setManipulatedModel(modelKey)
      setManual(true)
    }
    element.addEventListener('camera-change', onCameraChange)
    return () => element.removeEventListener('camera-change', onCameraChange)
  }, [enabled, libraryReady, modelKey])

  useEffect(() => {
    if (motion !== 'playing' || !visible || !activeDocument || !ready || failed || hovered || focused || manual) return
    const timer = setTimeout(() => setSelected(current => (current + 1) % dishes.length), 7000)
    return () => clearTimeout(timer)
  }, [motion, visible, activeDocument, ready, failed, hovered, focused, manual, selected])

  useEffect(() => {
    const element = viewer.current as (HTMLElement & { play?: () => void; pause?: () => void }) | null
    if (!element) return
    if (ready && !failed && manipulatedModel !== modelKey && motion === 'playing' && visible && activeDocument && !hovered && !focused) element.play?.()
    else element.pause?.()
    return () => element.pause?.()
  }, [ready, failed, motion, visible, activeDocument, hovered, focused, modelKey, libraryReady, manipulatedModel])

  const choose = (index: number) => {
    setManual(true)
    if (index !== selected) setManipulatedModel('')
    setFailed(false)
    setSelected(index)
    setAnnouncement(`${dishes[index].name}, ${index + 1} of ${dishes.length}`)
  }
  const controlClass = 'min-h-11 min-w-11 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current'

  return <div ref={root} className="mk-table-showcase" role="region" aria-roledescription="carousel" aria-label="Dishes at the Aurora table"
    data-current-dish={dish.id} data-model-ready={ready && !failed}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
    <div className="mk-table-scene" style={{ position: 'relative' }}>
      <HeroDishARButton dishId={dish.id} />
      <DeliveryImage src="/marketing/v3/table-photo.webp" alt="" aria-hidden="true" draggable={false} className="mk-table-photo"
        width={960} height={720} sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1239px) 45vw, 549px" preload
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <DeliveryImage key={dish.id} src={`${source}.webp`} alt={`${dish.name} served on a photographed restaurant table`} draggable={false}
        width={960} height={720} sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1239px) 45vw, 549px"
        className="mk-table-poster" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: ready && !failed ? 0 : 1 }} />
      {enabled && libraryReady ? <model-viewer key={modelKey} ref={viewer} src={modelSource}
        alt={`3D ${dish.name} on a photographed restaurant table`} poster={`${source}.webp`}
        className="mk-table-viewer" camera-orbit="0deg 62deg 0.55m" camera-target="0m 0.04m 0m" field-of-view="30deg"
        min-camera-orbit="auto 62deg 0.55m" max-camera-orbit="auto 62deg 0.55m" camera-controls disable-zoom disable-pan disable-tap touch-action="pan-y" interaction-prompt="none" loading="eager"
        shadow-intensity="0.7" shadow-softness="0.8" environment-image="neutral" exposure="1" tabIndex={ready && !failed ? 0 : -1} aria-hidden={!ready || failed}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: ready && !failed ? 1 : 0, pointerEvents: ready && !failed ? 'auto' : 'none' }}><span slot="progress-bar" hidden /></model-viewer> : null}
      {!enabled ? <button type="button" className={`mk-table-explore ${controlClass}`} onClick={() => setExplicit(true)}>Explore in 3D</button> : null}
      {failed ? <button type="button" className={`mk-table-retry ${controlClass}`} onClick={() => { setFailed(false); setLoaded(''); setRetry(current => current + 1) }}>
        <RotateCcw size={16} aria-hidden="true" /> Retry 3D
      </button> : null}
    </div>
    <div className="mk-table-caption">
      <div><span className="mk-eyebrow">Aurora · {dish.category}</span><p>{dish.name}</p></div>
      <Link href="/aurora" prefetch={false} className={controlClass}>Explore the menu</Link>
    </div>
    <div className="mk-table-controls" aria-label="Choose a dish">
      <button type="button" className={controlClass} aria-label="Previous dish" onClick={() => choose((selected + dishes.length - 1) % dishes.length)}><ArrowLeft size={18} aria-hidden="true" /></button>
      {dishes.map((item, index) => <button key={item.id} type="button" className={`mk-table-dot ${controlClass}`}
        aria-label={`Show ${item.name}`} aria-current={selected === index ? 'true' : undefined} onClick={() => choose(index)}><span aria-hidden="true">{index + 1}</span></button>)}
      <button type="button" className={controlClass} aria-label="Next dish" onClick={() => choose((selected + 1) % dishes.length)}><ArrowRight size={18} aria-hidden="true" /></button>
    </div>
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
  </div>
}
