/** Probe WebGL2 without accepting a major performance caveat for automatic 3D. */
export function canAutomaticallyRender3D(canvas: Pick<HTMLCanvasElement, 'getContext'>): boolean {
  let context: WebGL2RenderingContext | null = null
  let capable = false
  try {
    context = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true })
    if (!context) return false

    // Some browsers still expose software WebGL despite the performance caveat.
    const info = context.getExtension('WEBGL_debug_renderer_info')
    const renderer: unknown = info ? context.getParameter(info.UNMASKED_RENDERER_WEBGL) : null
    capable = typeof renderer !== 'string' || !/swiftshader|llvmpipe|softpipe|software rasterizer|microsoft basic render/i.test(renderer)
  } catch {
    capable = false
  } finally {
    // The actual renderer will create its own context; release this probe now.
    try {
      context?.getExtension('WEBGL_lose_context')?.loseContext()
    } catch {
      capable = false
    }
  }
  return capable
}
