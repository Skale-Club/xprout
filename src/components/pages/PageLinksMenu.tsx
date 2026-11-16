'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * The compact "More" menu of the restaurant's website pages, for the menu
 * header and the page header. A button that opens a short list of links;
 * Escape or a tap outside closes it.
 */
export default function PageLinksMenu({ tenantSlug, links, label, variant = 'overlay' }: {
  tenantSlug: string
  links: ReadonlyArray<{ slug: string; title: string }>
  label: string
  /** 'overlay' sits on the menu banner (white pill); 'bar' sits on the page header. */
  variant?: 'overlay' | 'bar'
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false) }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey) }
  }, [open])

  if (links.length === 0) return null
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(value => !value)}
        className={`flex h-10 items-center gap-1.5 rounded-full pl-3.5 pr-3 text-[14px] font-medium text-zinc-900 transition-[scale] active:scale-95 ${variant === 'overlay' ? 'bg-white/95 shadow-sm' : 'bg-white shadow-card ring-1 ring-black/5'}`}
      >
        <span>{label}</span>
        <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <ul id={listId} className="absolute right-0 z-30 mt-2 max-h-[60vh] min-w-[200px] max-w-[80vw] overflow-y-auto rounded-2xl bg-white p-1.5 shadow-card ring-1 ring-black/5">
          {links.map(link => (
            <li key={link.slug}>
              <a href={`/${tenantSlug}/${link.slug}`} className="block rounded-xl px-3.5 py-2.5 text-[15px] font-medium text-zinc-800 hover:bg-zinc-100">{link.title}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
