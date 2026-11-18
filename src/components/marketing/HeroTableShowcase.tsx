'use client'

import MorsePositionIndicator from '@/components/ui/MorsePositionIndicator'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react'
import { DeliveryImage } from '@/components/delivery-image'
import { useMarketingMotionPreference } from './MarketingMotion'
import HeroDishARButton from './HeroDishARButton'
import { usePublicLocale } from './PublicLocale'
import { canAutomaticallyRender3D } from '@/lib/marketing/automatic-3d'

const dishes = [
  { id: 'picanha', name: 'Premium Picanha' },
  { id: 'burger', name: 'Artisan Burger' },
  { id: 'tiramisu', name: 'Tiramisu' },
] as const

/** One photographed table, one active dish model, and a matching transparent poster. */
export default function HeroTableShowcase() {
  const { locale, t } = usePublicLocale()
  const motion = useMarketingMotionPreference()
  const root = useRef<HTMLDivElement>(null)
  const viewer = useRef<HTMLElement>(null)
  const [selected, setSelected] = useState(0)
  const [visible, setVisible] = useState(false)
  const [activeDocument, setActiveDocument] = useState(true)
  const [idle, setIdle] = useState(false)
  const [automatic3D, setAutomatic3D] = useState(false)
  const [explicit, setExplicit] = useState(false)
  const [libraryReady, setLibraryReady] = useState(false)
  const [loaded, setLoaded] = useState('')
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [manual, setManual] = useState(false)
  const [manipulatedModel, setManipulatedModel] = useState('')
  const [announcedIndex, setAnnouncedIndex] = useState<number>()
  const dish = dishes[selected]
  const source = `/marketing/v3/dish-${dish.id}`
  const modelSource = `${source}.glb${retry > 0 ? `?retry=${retry}` : ''}`
  const modelKey = `${dish.id}-${retry}`
  const enabled = explicit || (idle && automatic3D && motion !== 'reduced')
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
    const prepare = () => {
      // Avoid loading a renderer that would monopolize the CPU on software WebGL.
      // The matching posters keep the carousel available; 3D remains an opt-in.
      setAutomatic3D(canAutomaticallyRender3D(document.createElement('canvas')))
      setIdle(true)
    }
    const schedule = () => {
      if ('requestIdleCallback' in window) idleHandle = window.requestIdleCallback(prepare, { timeout: 4000 })
      else timer = setTimeout(prepare, 1200)
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
    if (motion !== 'playing' || !visible || !activeDocument || !(enabled ? ready : idle) || failed || hovered || focused || manual) return
    const timer = setTimeout(() => setSelected((selected + 1) % dishes.length), 7000)
    return () => clearTimeout(timer)
  }, [motion, visible, activeDocument, enabled, ready, idle, failed, hovered, focused, manual, selected])

  useEffect(() => {
    const element = viewer.current as (HTMLElement & { play?: () => void; pause?: () => void }) | null
    if (!element) return
    if (ready && !failed && manipulatedModel !== modelKey && motion === 'playing' && visible && activeDocument && !hovered && !focused) element.play?.()
    else element.pause?.()
    return () => element.pause?.()
  }, [ready, failed, motion, visible, activeDocument, hovered, focused, modelKey, libraryReady, manipulatedModel])

  function go(index: number) {
    if (index === selected) return
    setSelected(index)
  }
  const choose = (index: number) => {
    setManual(true)
    if (index !== selected) setManipulatedModel('')
    setFailed(false)
    go(index)
    setAnnouncedIndex(index)
  }
  const controlClass = 'min-h-11 min-w-11 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current'

  return <div ref={root} className="mk-table-showcase" role="region" aria-roledescription={t('carousel')} aria-label={t('Interactive dish demonstration')}
    data-current-dish={dish.id} data-model-ready={ready && !failed} data-automatic-3d={automatic3D}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
    <div className="mk-table-scene" style={{ position: 'relative' }}>
      <DeliveryImage src="/marketing/v3/table-photo.webp" alt="" aria-hidden="true" draggable={false} className="mk-table-photo"
        width={960} height={720} sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1239px) 45vw, 549px" preload
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      {/* Every poster stays mounted (and loaded), so switching never waits on an image. */}
      {dishes.map((item, index) => {
        const current = index === selected
        return <DeliveryImage key={item.id} src={`/marketing/v3/dish-${item.id}.webp`} alt={current ? t('{dish} served on a photographed restaurant table', { dish: t(item.name) }) : ''}
          aria-hidden={current ? undefined : true} draggable={false}
          loading={index === 0 ? 'eager' : 'lazy'} fetchPriority={index === 0 ? 'high' : 'low'}
          width={960} height={720} sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1239px) 45vw, 549px"
          className="mk-table-poster" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain',
            opacity: current && !(ready && !failed) ? 1 : 0,
            // A new dish fades in only after the old one has faded out (never two dishes at once);
            // its poster fades out when its own 3D takes over.
            transition: motion === 'reduced' ? 'none' : !current ? 'opacity 200ms ease-in' : ready && !failed ? 'opacity 450ms ease' : 'opacity 280ms ease 200ms' }} />
      })}
      {enabled && libraryReady ? <model-viewer key={modelKey} ref={viewer} src={modelSource}
        lang={locale} alt={t('3D {dish} on a photographed restaurant table', { dish: t(dish.name) })} poster={`${source}.webp`}
        className="mk-table-viewer" camera-orbit="0deg 62deg 0.55m" camera-target="0m 0.04m 0m" field-of-view="30deg"
        min-camera-orbit="auto 62deg 0.55m" max-camera-orbit="auto 62deg 0.55m" camera-controls disable-zoom disable-pan disable-tap touch-action="pan-y" interaction-prompt="none" loading="eager"
        shadow-intensity="0.7" shadow-softness="0.8" environment-image="neutral" exposure="1" tabIndex={ready && !failed ? 0 : -1} aria-hidden={!ready || failed}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: ready && !failed ? 1 : 0, pointerEvents: ready && !failed ? 'auto' : 'none' }}><span slot="progress-bar" hidden /></model-viewer> : null}
      <div className="mk-table-name-overlay" role="group" aria-label={t('Choose a dish')}>
        <div className="mk-table-controls">
          <button type="button" className={controlClass} aria-label={t('Previous dish')} onClick={() => choose((selected + dishes.length - 1) % dishes.length)}><ArrowLeft size={18} aria-hidden="true" /></button>
          <p className="mk-table-name">{t(dish.name)}</p>
          <button type="button" className={controlClass} aria-label={t('Next dish')} onClick={() => choose((selected + 1) % dishes.length)}><ArrowRight size={18} aria-hidden="true" /></button>
        </div>
      </div>
      <div className="mk-table-bottom-controls">
        <MorsePositionIndicator index={selected} total={dishes.length} label={t('Dish {position} of {total}', { position: selected + 1, total: dishes.length })} className="mk-table-position text-white" shadow />
        <HeroDishARButton dishId={dish.id} onExplore3D={() => { setExplicit(true); setManual(true) }} />
      </div>
      {failed ? <button type="button" className={`mk-table-retry ${controlClass}`} onClick={() => { setFailed(false); setLoaded(''); setRetry(current => current + 1) }}>
        <RotateCcw size={16} aria-hidden="true" />{' '}{t('Retry 3D')}
      </button> : null}
    </div>


    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcedIndex !== undefined && t('{dish}, {position} of {total}', { dish: t(dishes[announcedIndex].name), position: announcedIndex + 1, total: dishes.length })}</span>
  </div>
}
