/** One encoder per process, no in-memory wait queue; at most two during rolling deploy. */
let active = false
export const SOCIAL_IMAGE_MAX_BYTES = 180 * 1024

export async function boundedSocialRender(render: () => Promise<Uint8Array>, timeoutMs = 5000): Promise<Uint8Array> {
  if (active) throw new Error('Social image renderer is busy')
  active = true
  let timer: ReturnType<typeof setTimeout> | undefined
  const work = Promise.resolve().then(render).then(bytes => {
    if (bytes.byteLength > SOCIAL_IMAGE_MAX_BYTES) throw new Error('Social image exceeds its byte budget')
    return bytes
  }).finally(() => { active = false })
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Social image render timed out')), timeoutMs)
    })])
  } finally {
    clearTimeout(timer)
    // A timed-out encoder retains its slot until it actually settles. No
    // second job can compound a slow renderer's CPU/memory use.
  }
}
