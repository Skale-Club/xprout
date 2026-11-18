'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Box } from 'lucide-react'
import { usePublicLocale } from './PublicLocale'
import {
  AR_UNAVAILABLE_HASH, arFallbackUrl, arPlatform, currentArEnvironment,
  isComputer, openQuickLook, quickLookUrl, sceneViewerIntentUrl, type ArPlatform,
} from '@/lib/ar/launch'

const base = 'https://xmartmenu-product-images.skale.club/b5f74b1e-4d7f-4d17-8ea0-c3a1a42ae808/ar/'
const dishes = {
  picanha: { title: 'Premium Picanha', glb: '1794492655047-eek4j9.glb', usdz: '1794492658771-mul21c.usdz' },
  burger: { title: 'Artisan Burger', glb: '1794506931584-nofep0.glb', usdz: '1794506933329-tdxk7n.usdz' },
  tiramisu: { title: 'Tiramisu', glb: '1794494285272-hncsur.glb', usdz: '1794494287727-8i7dz6.usdz' },
} as const

export type HeroDishId = keyof typeof dishes

/** Published, calibrated menu models: native AR never uses marketing derivatives. */
export function getHeroArAction(dishId: HeroDishId, platform: ArPlatform | null, pageHref: string, title: string = dishes[dishId].title): string | null {
  const dish = dishes[dishId]
  if (platform === 'quick-look') return quickLookUrl(`${base}${dish.usdz}`, undefined, { realScale: true })
  if (platform === 'scene-viewer') return sceneViewerIntentUrl({
    glbUrl: `${base}${dish.glb}`, title, fallbackUrl: arFallbackUrl(pageHref), realScale: true,
  })
  return null
}

const subscribePlatform = () => () => {}
const platformSnapshot = () => {
  const environment = currentArEnvironment()
  const mobile = /iPhone|iPad|iPod|Android/i.test(environment.userAgent)
    || (/Macintosh/.test(environment.userAgent) && (environment.maxTouchPoints ?? 0) > 1)
  return mobile ? arPlatform(environment) : null
}
const serverPlatformSnapshot = () => null
const computerSnapshot = () => isComputer(currentArEnvironment())
// Hidden until hydration so computers never flash the phone-only control.
const serverComputerSnapshot = () => true

export default function HeroDishARButton({ dishId, onExplore3D }: { dishId: HeroDishId; onExplore3D?: () => void }) {
  const { t } = usePublicLocale()
  const platform = useSyncExternalStore(subscribePlatform, platformSnapshot, serverPlatformSnapshot)
  // Computers have no AR camera, and the hero already turns the dish in 3D there.
  const computer = useSyncExternalStore(subscribePlatform, computerSnapshot, serverComputerSnapshot)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const checkFallback = () => {
      if (window.location.hash !== AR_UNAVAILABLE_HASH) return
      setNotice('Camera viewing could not open on this phone. You can still turn the dish here.')
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`)
    }
    checkFallback()
    window.addEventListener('hashchange', checkFallback)
    return () => window.removeEventListener('hashchange', checkFallback)
  }, [])

  const title = t(dishes[dishId].title)
  const launch = () => {
    const href = getHeroArAction(dishId, platform, window.location.href, title)
    if (!href) {
      onExplore3D?.()
      setNotice('Drag to turn the dish. Open this page on a supported iPhone or Android phone to see it on your table through the camera.')
      return
    }
    setNotice('')
    if (platform === 'quick-look') openQuickLook(href)
    else window.location.assign(href)
  }

  if (computer) return null

  return <div className="mk-hero-ar">
    <button type="button" onClick={launch} className="mk-hero-ar-button min-h-11 min-w-11 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
      aria-label={t(platform ? 'See it on your table: {dish}' : 'Explore in 3D: {dish}', { dish: title })}>
      <Box size={17} aria-hidden="true" /><span>{t(platform ? 'See it on your table' : 'Explore in 3D')}</span>
    </button>
    <p className="mk-hero-ar-status" role="status" aria-live="polite">{notice && t(notice)}</p>
  </div>
}
