import { describe, expect, it, vi } from 'vitest'
import { canAutomaticallyRender3D } from '../../src/lib/marketing/automatic-3d'

function canvasWith(getContext: ReturnType<typeof vi.fn>): Pick<HTMLCanvasElement, 'getContext'> {
  return { getContext } as unknown as Pick<HTMLCanvasElement, 'getContext'>
}

describe('canAutomaticallyRender3D', () => {
  it('requires WebGL2 and refuses a major performance caveat', () => {
    const getContext = vi.fn().mockReturnValue(null)

    expect(canAutomaticallyRender3D(canvasWith(getContext))).toBe(false)
    expect(getContext).toHaveBeenCalledExactlyOnceWith('webgl2', { failIfMajorPerformanceCaveat: true })
  })

  it('returns false when context creation throws', () => {
    const getContext = vi.fn(() => { throw new Error('WebGL unavailable') })

    expect(canAutomaticallyRender3D(canvasWith(getContext))).toBe(false)
  })

  it('releases a successful probe before allowing automatic 3D', () => {
    const loseContext = vi.fn()
    const getExtension = vi.fn((name: string) => name === 'WEBGL_lose_context' ? { loseContext } : null)

    expect(canAutomaticallyRender3D(canvasWith(vi.fn().mockReturnValue({ getExtension })))).toBe(true)
    expect(getExtension).toHaveBeenCalledWith('WEBGL_lose_context')
    expect(loseContext).toHaveBeenCalledOnce()
  })

  it('allows WebGL2 when the optional context release extension is unavailable', () => {
    const getExtension = vi.fn().mockReturnValue(null)

    expect(canAutomaticallyRender3D(canvasWith(vi.fn().mockReturnValue({ getExtension })))).toBe(true)
  })

  it('fails safely if the probe cleanup throws', () => {
    const getExtension = vi.fn((name: string) => name === 'WEBGL_lose_context' ? { loseContext: () => { throw new Error('Context lost') } } : null)

    expect(canAutomaticallyRender3D(canvasWith(vi.fn().mockReturnValue({ getExtension })))).toBe(false)
  })

  it.each(['ANGLE (Google, Vulkan SwiftShader)', 'llvmpipe', 'softpipe', 'Software Rasterizer', 'Microsoft Basic Render Driver'])('rejects software renderer %s and releases its probe', renderer => {
    const loseContext = vi.fn()
    const getExtension = vi.fn((name: string) => name === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 37446 } : { loseContext })
    const getParameter = vi.fn().mockReturnValue(renderer)

    expect(canAutomaticallyRender3D(canvasWith(vi.fn().mockReturnValue({ getExtension, getParameter })))).toBe(false)
    expect(getParameter).toHaveBeenCalledExactlyOnceWith(37446)
    expect(loseContext).toHaveBeenCalledOnce()
  })

  it('allows a hardware renderer and releases its probe', () => {
    const loseContext = vi.fn()
    const getExtension = vi.fn((name: string) => name === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 37446 } : { loseContext })
    const getParameter = vi.fn().mockReturnValue('ANGLE (Intel, Intel Iris Xe Graphics)')

    expect(canAutomaticallyRender3D(canvasWith(vi.fn().mockReturnValue({ getExtension, getParameter })))).toBe(true)
    expect(loseContext).toHaveBeenCalledOnce()
  })

  it('releases the probe if renderer inspection throws', () => {
    const loseContext = vi.fn()
    const getExtension = vi.fn((name: string) => name === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 37446 } : { loseContext })
    const getParameter = vi.fn(() => { throw new Error('Renderer unavailable') })

    expect(canAutomaticallyRender3D(canvasWith(vi.fn().mockReturnValue({ getExtension, getParameter })))).toBe(false)
    expect(loseContext).toHaveBeenCalledOnce()
  })
})
