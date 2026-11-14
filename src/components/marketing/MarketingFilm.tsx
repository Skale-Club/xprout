'use client'

import { useEffect, useRef, useState } from 'react'
import { Play } from 'lucide-react'
import { DeliveryImage } from '@/components/delivery-image'
import { useMarketingMotionPreference } from './MarketingMotion'

/** Download on visibility and loop quietly without player chrome. */
export default function MarketingFilm() {
  const root = useRef<HTMLElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const motion = useMarketingMotionPreference()
  const previousMotion = useRef(motion)
  const requested = useRef(false)
  const visible = useRef(false)
  const manualOverride = useRef(false)
  const failure = useRef(false)
  const attempt = useRef(0)
  const [started, setStarted] = useState(false)
  const [failed, setFailed] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    const media = video.current
    if (!media) return
    if (motion !== previousMotion.current && motion !== 'playing') manualOverride.current = false
    previousMotion.current = motion
    const syncPlayback = () => {
      const allowed = motion === 'playing' || (motion === 'reduced' && manualOverride.current)
      if (!visible.current || document.visibilityState !== 'visible' || !allowed) {
        media.pause()
        return
      }
      if (failure.current) return
      if (!requested.current) {
        media.src = '/marketing/v3/restaurant-film.mp4'
        requested.current = true
      }
      void media.play().catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setBlocked(true)
        setStatus('Press play to watch the film.')
      })
    }
    const onVisibility = () => {
      syncPlayback()
    }
    document.addEventListener('visibilitychange', onVisibility)
    const observer = typeof globalThis.IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([entry]) => {
        const nextVisible = entry.isIntersecting && entry.intersectionRatio >= .05
        visible.current = nextVisible
        syncPlayback()
      }, { threshold: .05 })
      : null
    observer?.observe(media)
    const checkBounds = () => {
      const bounds = media.getBoundingClientRect()
      const nextVisible = bounds.bottom > 0 && bounds.top < window.innerHeight
      visible.current = nextVisible
      syncPlayback()
    }
    if (!observer) {
      checkBounds()
      window.addEventListener('scroll', checkBounds, { passive: true })
      window.addEventListener('resize', checkBounds)
    } else syncPlayback()
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('scroll', checkBounds)
      window.removeEventListener('resize', checkBounds)
      observer?.disconnect()
      media.pause()
    }
  }, [motion])

  const play = () => {
    const element = video.current
    if (!element) return
    if (failed) {
      attempt.current += 1
      element.src = `/marketing/v3/restaurant-film.mp4?retry=${attempt.current}`
    } else if (!requested.current) {
      // Attach and play during the click so mobile browsers retain user activation.
      element.src = '/marketing/v3/restaurant-film.mp4'
    }
    requested.current = true
    manualOverride.current = true
    failure.current = false
    setBlocked(false)
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
        <video ref={video} controls={false} disablePictureInPicture disableRemotePlayback muted loop playsInline preload="none" tabIndex={-1} className="mk-film-video"
          aria-label="A short silent food film featuring burger, pizza and sushi"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: started && !failed ? 1 : 0, pointerEvents: 'none' }}
          onPlaying={() => { setStarted(true); setFailed(false); setBlocked(false); setStatus('') }}
          onError={() => { failure.current = true; setFailed(true); setStarted(false); setStatus('The film could not load. Please try again.') }} />
        {failed || blocked || (motion === 'reduced' && !started) ? <button type="button" onClick={play} className="mk-film-play min-h-11 min-w-11 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
          style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
          <Play size={18} aria-hidden="true" /><span>{failed ? 'Retry the film' : 'Play the film'}</span>
        </button> : null}
      </div>
      <p className="mk-film-status" role="status" aria-live="polite">{status}</p>
    </div>
  </section>
}
