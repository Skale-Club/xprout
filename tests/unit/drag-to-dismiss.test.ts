import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDragToDismiss } from '@/components/ui/use-drag-to-dismiss'

const { cleanups } = vi.hoisted(() => ({ cleanups: [] as Array<() => void> }))
vi.mock('react', () => ({
  useRef: (initial: unknown) => ({ current: initial }),
  useEffect: (effect: () => void | (() => void)) => {
    const cleanup = effect()
    if (cleanup) cleanups.push(cleanup)
  },
}))

class Surface extends EventTarget {
  style = { transition: '', transform: '', backgroundColor: '' }
  offsetHeight = 600
  scrollTop = 0
}

function touch(target: Surface, type: string, x: number, y: number, time: number) {
  const event = new Event(type, { cancelable: true })
  Object.defineProperties(event, {
    touches: { value: type === 'touchend' ? [] : [{ clientX: x, clientY: y }] },
    timeStamp: { value: time },
  })
  target.dispatchEvent(event)
  return event
}

function setup(scrollTop = 0) {
  const sheet = new Surface(), scroll = new Surface(), backdrop = new Surface()
  scroll.scrollTop = scrollTop
  const onDismiss = vi.fn()
  const ref = (surface: Surface) => ({ current: surface as unknown as HTMLElement })
  // eslint-disable-next-line react-hooks/rules-of-hooks -- Isolated harness runs the mocked React effects synchronously.
  useDragToDismiss({ sheetRef: ref(sheet), scrollRef: ref(scroll), backdropRef: ref(backdrop), onDismiss })
  touch(sheet, 'touchstart', 100, 100, 0)
  return { sheet, backdrop, onDismiss }
}

describe('sheet drag and native overscroll', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }), setTimeout: globalThis.setTimeout })
  })
  afterEach(() => {
    cleanups.splice(0).forEach(cleanup => cleanup())
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('blocks native top bounce before the sheet passes its drag threshold', () => {
    const { sheet } = setup()
    expect(touch(sheet, 'touchmove', 101, 104, 20).defaultPrevented).toBe(true)
    expect(sheet.style.transform).toBe('')
  })

  it('keeps upward scrolling, horizontal swipes and scrolled content native', () => {
    for (const [top, x, y] of [[0, 100, 80], [0, 120, 102], [30, 100, 120]]) {
      const { sheet } = setup(top)
      expect(touch(sheet, 'touchmove', x, y, 100).defaultPrevented).toBe(false)
      expect(sheet.style.transform).toBe('')
    }
  })

  it('moves the whole sheet and snaps a short slow pull back', () => {
    const { sheet, backdrop, onDismiss } = setup()
    expect(touch(sheet, 'touchmove', 100, 120, 100).defaultPrevented).toBe(true)
    expect(sheet.style.transform).toBe('translateY(20px)')
    touch(sheet, 'touchend', 100, 120, 120)
    expect(sheet.style.transform).toBe('translateY(0px)')
    expect(backdrop.style.backgroundColor).toBe('')
    vi.runAllTimers()
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('still dismisses a long pull', () => {
    const { sheet, onDismiss } = setup()
    touch(sheet, 'touchmove', 100, 300, 400)
    touch(sheet, 'touchend', 100, 300, 410)
    vi.advanceTimersByTime(240)
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
