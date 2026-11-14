import { describe, expect, it } from 'vitest'
import { getHeroArAction, type HeroDishId } from '@/components/marketing/HeroDishARButton'

const models = [
  ['picanha', '1794492655047-eek4j9.glb', '1794492658771-mul21c.usdz'],
  ['burger', '1794506931584-nofep0.glb', '1794506933329-tdxk7n.usdz'],
  ['tiramisu', '1794494285272-hncsur.glb', '1794494287727-8i7dz6.usdz'],
] as const

describe('hero native AR uses the published real-scale dishes', () => {
  it.each(models)('opens %s in Quick Look without cart actions', (id, _glb, usdz) => {
    const url = new URL(getHeroArAction(id, 'quick-look', 'https://xprout.app/')!)
    expect(url.hostname).toBe('xmartmenu-product-images.skale.club')
    expect(url.pathname.endsWith(`/${usdz}`)).toBe(true)
    expect(url.hash).toBe('#allowsContentScaling=0')
    expect(url.href).not.toContain('/marketing/')
  })
  it.each(models)('opens %s with the existing Android native fallback', (id, glb) => {
    const intent = getHeroArAction(id, 'scene-viewer', 'https://xprout.app/?preview=1#film')!
    const params = new URLSearchParams(intent.split('?')[1].split('#Intent')[0])
    expect(params.get('file')?.endsWith(`/${glb}`)).toBe(true)
    expect(params.get('mode')).toBe('ar_preferred')
    expect(params.get('resizable')).toBe('false')
    expect(intent).toContain('package=com.google.android.googlequicksearchbox')
    expect(intent).toContain(encodeURIComponent('https://xprout.app/?preview=1#ar-unavailable'))
  })
  it('does not invent an AR route on an unsupported platform', () => {
    for (const id of models.map(row => row[0] as HeroDishId)) expect(getHeroArAction(id, null, 'https://xprout.app/')).toBeNull()
  })
})
