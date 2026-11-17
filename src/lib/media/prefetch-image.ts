import { cardVariantUrl, isManagedImage } from './image-source'

/**
 * Loads images before the guest reaches them, like a game streaming the next area: the browser cache
 * then has the file when the <img> asks for it. A small queue keeps at most a few downloads in flight
 * so warming never competes with what is on screen, and nothing is fetched on Save-Data or 2G.
 *
 * Only exact URLs the page will render are worth fetching: stored images are rendered as is
 * (DeliveryImage), and in development every image is (next.config.ts `unoptimized`).
 */

const MAX_IN_FLIGHT = 4
const seen = new Set<string>()
const queue: string[] = []
let inFlight = 0

function allowed(): boolean {
  if (typeof window === 'undefined') return false
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  return !connection?.saveData && !/2g$/.test(connection?.effectiveType ?? '')
}

function renderedAsIs(src: string): boolean {
  return isManagedImage(src) || process.env.NODE_ENV === 'development'
}

function pump() {
  while (inFlight < MAX_IN_FLIGHT && queue.length) {
    const url = queue.shift()!
    inFlight++
    const image = new window.Image()
    image.decoding = 'async'
    image.onload = image.onerror = () => { inFlight--; pump() }
    image.src = url
  }
}

/** `urgent` jumps the queue (the dish under the guest's finger); the rest waits its turn. */
export function prefetchImage(src: string | null | undefined, { variant = 'full', urgent = false }: { variant?: 'card' | 'full'; urgent?: boolean } = {}) {
  if (!src || !allowed() || !renderedAsIs(src)) return
  const url = (variant === 'card' && cardVariantUrl(src)) || src
  if (seen.has(url)) return
  seen.add(url)
  if (urgent) queue.unshift(url)
  else queue.push(url)
  pump()
}

/** Runs once the page is idle, so warming starts after what is on screen has loaded. */
export function whenIdle(task: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(task, { timeout: 3000 })
    return () => window.cancelIdleCallback(id)
  }
  const id = setTimeout(task, 1500)
  return () => clearTimeout(id)
}
