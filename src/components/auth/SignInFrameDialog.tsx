'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import ModalPortal from '@/components/ui/ModalPortal'
import { useVisibleViewport } from '@/components/ui/use-visible-viewport'
import GradientTopLine from '@/components/ui/GradientTopLine'

/** Paths that are still part of signing in; leaving them means the person is signed in. */
const SIGN_IN_PATHS = ['/auth/', '/identity']
const isSignInPath = (path: string) => SIGN_IN_PATHS.some(prefix => path.startsWith(prefix))

/**
 * The platform's own sign-in (/auth/login?embed=1…) in a same-origin frame,
 * as a card over the current page, so nobody is sent to another page to sign
 * in: the guest popup on a menu (light, restaurant card) and the sign-in on
 * the marketing site (dark, platform card). The page inside draws the whole
 * card; this only holds it, sizes it to its content, keeps it in what the
 * phone keyboard leaves visible, and notices when the sign-in finished: the
 * frame then navigates off the sign-in pages, and `onSignedIn` gets that path
 * (where the sign-in wanted to go).
 */
export default function SignInFrameDialog({ src, unavailable, title, closeLabel, onClose, onSignedIn, tone = 'light', closeTop = 12 }: {
  /** Null while the sign-in mode is still being read. */
  src: string | null
  unavailable: boolean
  title: string
  closeLabel: string
  onClose: () => void
  onSignedIn: (path: string) => void
  tone?: 'light' | 'dark' | 'marketing'
  /** Where the close button sits, to centre it on the card's own header. */
  closeTop?: number
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const view = useVisibleViewport()
  const [height, setHeight] = useState(440)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const observer = useRef<ResizeObserver | null>(null)
  const dark = tone === 'dark'
  const marketing = tone === 'marketing'

  useEffect(() => () => observer.current?.disconnect(), [])
  useEffect(() => {
    if (!src || ready || loadError) return
    const timer = window.setTimeout(() => setLoadError(true), 15000)
    return () => window.clearTimeout(timer)
  }, [src, ready, loadError])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!src) return
    let finished = false
    const check = () => {
      const frame = frameRef.current
      if (finished || !frame) return
      let location: Location | undefined
      try { location = frame.contentWindow?.location } catch { return }
      const path = location?.pathname ?? ''
      if (path && path !== 'blank' && !isSignInPath(path)) {
        finished = true
        const destination = `${path}${location?.search ?? ''}`
        frame.src = 'about:blank'
        onSignedIn(destination)
      }
    }
    const timer = window.setInterval(check, 200)
    return () => window.clearInterval(timer)
  }, [src, onSignedIn])

  const onLoad = () => {
    const frame = frameRef.current
    const doc = (() => { try { return frame?.contentDocument ?? null } catch { return null } })()
    observer.current?.disconnect()
    const content = doc?.querySelector('main')
    // Error documents (including a host-rejected 404) must not collapse the card.
    if (!frame || !content) { setLoadError(true); return }
    // The sign-in itself, not the frame document (which can report a taller box: a blank strip).
    const measure = () => setHeight(Math.max(160, Math.ceil(content.getBoundingClientRect().height)))
    observer.current = new ResizeObserver(measure)
    observer.current.observe(content)
    // Show the card only once its fonts are in and it has settled, already at its final height:
    // no empty card first and no jump when the content arrives.
    const fonts = doc?.fonts?.ready ?? Promise.resolve()
    const settled = Promise.race([fonts, new Promise(resolve => window.setTimeout(resolve, 800))])
    void settled.then(() => window.requestAnimationFrame(() => window.requestAnimationFrame(() => { measure(); setReady(true) })))
  }

  const shown = ready || unavailable || loadError
  return (
    <ModalPortal closeOnEscape={false}>
      <div className="fixed inset-0 z-50" onClick={onClose}>
        {/* The marketing popup only dims the page: no frosted blur behind it. */}
        <div className={`absolute inset-0 ${marketing ? 'bg-black/50' : dark ? 'bg-black/70 backdrop-blur-sm' : 'bg-black/60 backdrop-blur-sm'}`} />
        <div
          className="absolute inset-x-0 flex items-center justify-center p-4"
          style={view.height ? { top: view.top, height: view.height } : { inset: 0 }}
        >
          {!shown && (
            <span aria-hidden="true" className={`absolute size-7 animate-spin rounded-full border-2 ${marketing || dark ? 'border-white/25 border-t-white' : 'border-white/30 border-t-white'}`} />
          )}
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            aria-busy={!shown}
            className={`relative w-full overflow-hidden transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${shown ? 'opacity-100 scale-100' : 'pointer-events-none scale-[0.98] opacity-0'} ${marketing ? 'max-w-[420px] rounded-[28px] border border-white/10 bg-[#323A35] shadow-[0_24px_80px_rgba(0,0,0,0.35)]' : dark ? 'max-w-sm rounded-[1.25rem] border border-white/10 bg-zinc-900 shadow-[0_24px_80px_rgba(0,0,0,0.45)]' : 'max-w-[400px] rounded-2xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.45)]'}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Xpot's thin gradient line, fading out before the rounded corners. */}
            {dark || marketing ? <GradientTopLine glow={false} /> : null}
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              style={{ top: closeTop }}
              className={`absolute right-3 z-10 flex size-11 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${marketing ? 'text-platform-ivory hover:bg-white/10' : dark ? 'bg-white/5 text-zinc-300 hover:bg-white/10' : 'bg-white/95 text-zinc-900 shadow-sm hover:bg-white'}`}
            >
              <X className="size-[18px]" />
            </button>
            {unavailable || loadError ? (
              <div className={`px-6 pb-8 pt-16 text-center text-[15px] leading-6 ${marketing ? 'text-platform-ivory' : dark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                <p role="alert">Sign-in could not load. Please try again.</p>
                {loadError && !unavailable ? <button type="button" onClick={() => { setReady(false); setLoadError(false) }} className="mt-5 min-h-11 rounded-full border border-current px-6 font-semibold">Try again</button> : null}
              </div>
            ) : (
              <>
                {src && (
                  <iframe
                    ref={frameRef}
                    src={src}
                    title={title}
                    onLoad={onLoad}
                    onError={() => setLoadError(true)}
                    className={ready ? 'block w-full border-0' : 'absolute h-0 w-full opacity-0'}
                    // Never taller than what the keyboard leaves: the sign-in then scrolls inside the frame.
                    style={ready ? { height: view.height ? Math.min(height, Math.max(80, view.height - 32)) : height, colorScheme: dark ? 'dark' : 'light' } : undefined}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
