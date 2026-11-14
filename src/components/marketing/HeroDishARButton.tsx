'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Box } from 'lucide-react'
import {
  AR_UNAVAILABLE_HASH, arFallbackUrl, arPlatform, currentArEnvironment,
  openQuickLook, quickLookUrl, sceneViewerIntentUrl, type ArPlatform,
} from '@/lib/ar/launch'

const base = 'https://xmartmenu-product-images.skale.club/b5f74b1e-4d7f-4d17-8ea0-c3a1a42ae808/ar/'
const dishes = {
  picanha: { title: 'Premium Picanha', glb: '1794492655047-eek4j9.glb', usdz: '1794492658771-mul21c.usdz' },
  burger: { title: 'Artisan Burger', glb: '1794506931584-nofep0.glb', usdz: '1794506933329-tdxk7n.usdz' },
  tiramisu: { title: 'Tiramisu', glb: '1794494285272-hncsur.glb', usdz: '1794494287727-8i7dz6.usdz' },
} as const

export type HeroDishId = keyof typeof dishes

/** Published, calibrated menu models: native AR never uses marketing derivatives. */
export function getHeroArAction(dishId: HeroDishId, platform: ArPlatform | null, pageHref: string): string | null {
  const dish = dishes[dishId]
  if (platform === 'quick-look') return quickLookUrl(`${base}${dish.usdz}`, undefined, { realScale: true })
  if (platform === 'scene-viewer') return sceneViewerIntentUrl({
    glbUrl: `${base}${dish.glb}`, title: dish.title, fallbackUrl: arFallbackUrl(pageHref), realScale: true,
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

export default function HeroDishARButton({ dishId }: { dishId: HeroDishId }) {
  const platform = useSyncExternalStore(subscribePlatform, platformSnapshot, serverPlatformSnapshot)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const checkFallback = () => {
      if (window.location.hash !== AR_UNAVAILABLE_HASH) return
      setNotice('AR could not open on this device. You can still turn the dish here.')
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`)
    }
    checkFallback()
    window.addEventListener('hashchange', checkFallback)
    return () => window.removeEventListener('hashchange', checkFallback)
  }, [])

  if (!platform) return null
  const dish = dishes[dishId]
  const launch = () => {
    const href = getHeroArAction(dishId, platform, window.location.href)
    if (!href) return
    setNotice('')
    if (platform === 'quick-look') openQuickLook(href)
    else window.location.assign(href)
  }

  return <div className="mk-hero-ar">
    <button type="button" onClick={launch} className="mk-hero-ar-button min-h-11 min-w-11 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
      aria-label={`View ${dish.title} in your space in AR`}>
      <Box size={17} aria-hidden="true" /><span>View in 3D</span>
    </button>
    <p className="mk-hero-ar-status" role="status" aria-live="polite">{notice}</p>
  </div>
}
