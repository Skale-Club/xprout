'use client'

import { useEffect, useRef, useState } from 'react'
import { Play } from 'lucide-react'
import { DeliveryImage } from '@/components/delivery-image'
import { useMarketingMotionPreference } from './MarketingMotion'

/** The film is downloaded only after a guest explicitly asks to watch it. */
export default function MarketingFilm() {
  const root = useRef<HTMLElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const motion = useMarketingMotionPreference()
  const previousMotion = useRef(motion)
  const [requested, setRequested] = useState(false)
  const [started, setStarted] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState('')
  const source = `/marketing/v3/restaurant-film.mp4${attempt > 0 ? `?retry=${attempt}` : ''}`

  useEffect(() => {
    if (motion !== previousMotion.current && motion !== 'playing') video.current?.pause()
    previousMotion.current = motion
  }, [motion])

  useEffect(() => {
    const media = video.current
    const onVisibility = () => { if (document.visibilityState !== 'visible') media?.pause() }
    document.addEventListener('visibilitychange', onVisibility)
    const element = video.current
    const observer = element && typeof globalThis.IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) media?.pause() }, { threshold: .05 })
      : null
    if (element) observer?.observe(element)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      observer?.disconnect()
      media?.pause()
    }
  }, [])

  const play = () => {
    const element = video.current
    if (!element) return
    if (failed) {
      const nextAttempt = attempt + 1
      setAttempt(nextAttempt)
      element.src = `/marketing/v3/restaurant-film.mp4?retry=${nextAttempt}`
    } else if (!requested) {
      // Attach and play during the click so mobile browsers retain user activation.
      element.src = source
    }
    setRequested(true)
    setFailed(false)
    setStatus('Loading the film.')
    void element.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setStatus('')
        return
      }
      setStarted(false)
      setFailed(true)
      setStatus('The film could not play. Please try again.')
    })
  }

  return <section ref={root} id="film" className="mk-film mk-section" aria-labelledby="marketing-film-title">
    <div className="mk-container">
      <div className="mk-film-copy">
        <p className="mk-eyebrow">Made to whet the appetite</p>
        <h2 id="marketing-film-title" className="mk-h2">Good food deserves a closer look.</h2>
        <p className="mk-lead">From the first glance to the first choice. Put your dishes in the spotlight.</p>
      </div>
      <div className="mk-film-player" style={{ position: 'relative', aspectRatio: '16 / 9', overflow: 'hidden' }}>
        <DeliveryImage src="/marketing/v3/restaurant-film-poster.webp" alt="A cinematic close-up of freshly prepared food"
          width={1280} height={720} sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1239px) calc(100vw - 80px), 1160px"
          className="mk-film-poster" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: started && !failed ? 0 : 1 }} />
        <video ref={video} controls={started && !failed} playsInline preload="none" className="mk-film-video"
          aria-label="A short silent food film featuring burger, pizza and sushi"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: started && !failed ? 1 : 0, pointerEvents: started && !failed ? 'auto' : 'none' }}
          onPlaying={() => { setStarted(true); setFailed(false); setStatus('') }}
          onError={() => { setFailed(true); setStarted(false); setStatus('The film could not load. Please try again.') }} />
        {!started || failed ? <button type="button" onClick={play} className="mk-film-play min-h-11 min-w-11 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
          style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
          <Play size={18} aria-hidden="true" /><span>{failed ? 'Retry the film' : 'Play the film'}</span>
        </button> : null}
      </div>
      <p className="mk-film-status" role="status" aria-live="polite">{status}</p>
    </div>
  </section>
}
