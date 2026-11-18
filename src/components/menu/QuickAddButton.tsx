'use client'

import { Loader2, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/** How long one add shows its loader; taps inside it are ignored, so a burst cannot flood the order. */
export const QUICK_ADD_COOLDOWN_MS = 450

/**
 * The + that sits on a dish photo (grid card and featured rail), DoorDash style: one tap puts one more
 * of the dish in the order, never opens a stepper. A short loader confirms the add and absorbs repeated
 * taps; a small badge shows how many are already in the order. Quantities are edited in the cart.
 * Placement comes from the parent (`className`), e.g. `absolute bottom-2 right-2`.
 */
export function QuickAddButton({ label, quantity = 0, onAdd, badgeColor, badgeText, tabIndex, className = '' }: {
  label: string
  quantity?: number
  onAdd: () => void
  badgeColor: string
  badgeText: string
  tabIndex?: number
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return (
    <button
      type="button"
      tabIndex={tabIndex}
      aria-label={label}
      aria-busy={busy}
      onClick={event => {
        event.stopPropagation()
        if (busy) return
        setBusy(true)
        onAdd()
        timer.current = setTimeout(() => setBusy(false), QUICK_ADD_COOLDOWN_MS)
      }}
      // 44px touch target around a 36px white circle.
      className={`pointer-events-auto z-10 flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${className}`}
    >
      <span className="relative flex size-9 items-center justify-center rounded-full bg-white text-zinc-900 shadow-[0_1px_3px_rgb(0_0_0/0.18),0_4px_12px_rgb(0_0_0/0.14)] transition-transform active:scale-90">
        {busy
          ? <Loader2 className="size-[18px] animate-spin" strokeWidth={2.5} aria-hidden="true" />
          : <Plus className="size-[18px]" strokeWidth={2.5} aria-hidden="true" />}
        {quantity > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums shadow-sm"
            style={{ backgroundColor: badgeColor, color: badgeText }}
            aria-live="polite"
          >
            {quantity}
          </span>
        )}
      </span>
    </button>
  )
}
