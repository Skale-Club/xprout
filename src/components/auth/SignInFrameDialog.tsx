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
    setReady(true)
    // The sign-in itself, not the frame document (which can report a taller box: a blank strip).
    const measure = () => setHeight(Math.max(160, Math.ceil(content.getBoundingClientRect().height)))
    measure()
    observer.current = new ResizeObserver(measure)
    observer.current.observe(content)
  }

  return (
    <ModalPortal closeOnEscape={false}>
      <div className="fixed inset-0 z-50" onClick={onClose}>
        <div className={`absolute inset-0 backdrop-blur-sm ${marketing ? 'bg-[#14271d]/55' : dark ? 'bg-black/70' : 'bg-black/60'}`} />
        <div
          className="absolute inset-x-0 flex items-center justify-center p-4"
          style={view.height ? { top: view.top, height: view.height } : { inset: 0 }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`relative w-full overflow-hidden ${marketing ? 'max-w-[420px] rounded-[28px] border border-platform-forest/15 bg-platform-ivory shadow-[0_24px_80px_rgba(0,0,0,0.3)]' : dark ? 'max-w-sm rounded-[1.25rem] border border-white/10 bg-zinc-900 shadow-[0_24px_80px_rgba(0,0,0,0.45)]' : 'max-w-[400px] rounded-2xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.45)]'}`}
            onClick={e => e.stopPropagation()}
          >
            {dark ? <GradientTopLine glow={false} /> : null}
            {marketing ? <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-platform-brand-accent" /> : null}
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              style={{ top: closeTop }}
              className={`absolute right-3 z-10 flex size-11 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${marketing ? 'text-platform-forest hover:bg-platform-forest/5' : dark ? 'bg-white/5 text-zinc-300 hover:bg-white/10' : 'bg-white/95 text-zinc-900 shadow-sm hover:bg-white'}`}
            >
              <X className="size-[18px]" />
            </button>
            {unavailable || loadError ? (
              <div className={`px-6 pb-8 pt-16 text-center text-[15px] leading-6 ${marketing ? 'text-platform-forest' : dark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                <p role="alert">Sign-in could not load. Please try again.</p>
                {loadError && !unavailable ? <button type="button" onClick={() => { setReady(false); setLoadError(false) }} className="mt-5 min-h-11 rounded-full border border-current px-6 font-semibold">Try again</button> : null}
              </div>
            ) : (
              <>
                {!ready && (
                  <div className="flex h-[440px] items-center justify-center" aria-hidden="true">
                    <span className={`size-6 animate-spin rounded-full border-2 ${marketing ? 'border-platform-forest/20 border-t-platform-forest' : dark ? 'border-white/20 border-t-white' : 'border-zinc-200 border-t-zinc-700'}`} />
                  </div>
                )}
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
