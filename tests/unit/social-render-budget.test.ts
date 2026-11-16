import { describe, expect, it } from 'vitest'
import { boundedSocialRender, SOCIAL_IMAGE_MAX_BYTES } from '@/lib/site/social-render-budget'

describe('bounded brand social rendering', () => {
  it('verifies actual encoded bytes and releases the slot after failure', async () => {
    await expect(boundedSocialRender(async () => new Uint8Array(SOCIAL_IMAGE_MAX_BYTES+1))).rejects.toThrow('byte budget')
    expect(await boundedSocialRender(async () => new Uint8Array([1,2]))).toEqual(new Uint8Array([1,2]))
  })
  it('rejects excess concurrency without buffering a queue', async () => {
    let release!: (value: Uint8Array) => void
    const first = boundedSocialRender(() => new Promise<Uint8Array>(resolve => { release=resolve }))
    await Promise.resolve()
    await expect(boundedSocialRender(async () => new Uint8Array())).rejects.toThrow('busy')
    release(new Uint8Array([1]))
    await first
  })
  it('retains the concurrency slot after a response deadline until work settles', async () => {
    let release!: (value: Uint8Array) => void
    const work = boundedSocialRender(() => new Promise<Uint8Array>(resolve => { release=resolve }),5)
    await expect(work).rejects.toThrow('timed out')
    await expect(boundedSocialRender(async () => new Uint8Array())).rejects.toThrow('busy')
    release(new Uint8Array([1]))
    await new Promise<void>(resolve => setTimeout(resolve,0))
    expect(await boundedSocialRender(async () => new Uint8Array([2]))).toEqual(new Uint8Array([2]))
  })
})
