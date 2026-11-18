'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Palette, Save } from 'lucide-react'
import type { DesignSlotDef, DesignVariants } from '@/lib/design-variants'

interface Payload {
  slots: DesignSlotDef[]
  stored: DesignVariants
  resolved: Record<string, string>
  /** False until the schema step added tenant_settings.design_variants. */
  ready: boolean
}

/** Superadmin › client › design variants: which registered look this client uses in each slot. */
export default function TenantDesignVariantsCard({ tenantId }: { tenantId: string }) {
  const url = `/api/superadmin/tenants/${tenantId}/design-variants`
  const [data, setData] = useState<Payload | null>(null)
  const [choice, setChoice] = useState<DesignVariants>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  function apply(next: Payload) {
    setData(next)
    setChoice(next.stored)
  }

  useEffect(() => {
    fetch(url).then(async res => { if (res.ok) apply((await res.json()) as Payload) }).catch(() => {})
  }, [url])

  async function save() {
    setBusy(true)
    setMessage(null)
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ variants: choice }) })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setMessage({ ok: false, text: json.error ?? 'Could not save' })
    apply(json as Payload)
    setMessage({ ok: true, text: 'Saved' })
  }

  function pick(slotId: string, variantId: string) {
    setChoice(current => {
      const next = { ...current }
      if (variantId) next[slotId] = variantId
      else delete next[slotId]
      return next
    })
  }

  const input = 'min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-[border-color,box-shadow] duration-150 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50'

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="tenant-design-variants-title">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600"><Palette className="size-4" /></span>
        <div>
          <h2 id="tenant-design-variants-title" className="text-sm font-bold text-zinc-950">Design variants</h2>
          <p className="text-xs text-zinc-500">Which registered look this client uses on its public menu. Off for everyone unless chosen here.</p>
        </div>
      </div>

      {!data ? (
        <p className="flex items-center gap-2 text-sm text-zinc-500"><Loader2 className="size-4 animate-spin" />Loading…</p>
      ) : !data.ready ? (
        <p className="text-xs text-zinc-500">The schema step has not run yet (docs/owned-schema/20261118100000_tenant_design_variants.sql), so variants cannot be saved.</p>
      ) : data.slots.length === 0 ? (
        <p className="text-xs text-zinc-500">No design variants yet. A variant is registered in src/lib/design-variants.ts when a client asks for its own look.</p>
      ) : (
        <div className="space-y-3">
          {data.slots.map(slot => {
            const fallback = slot.variants.find(variant => variant.id === slot.defaultVariant)
            return (
              <div key={slot.id}>
                <label htmlFor={`design-slot-${slot.id}`} className="mb-1.5 block text-xs font-bold text-zinc-600">{slot.label}</label>
                <select id={`design-slot-${slot.id}`} value={choice[slot.id] ?? ''} onChange={e => pick(slot.id, e.target.value)} className={input}>
                  <option value="">Default ({fallback?.label ?? slot.defaultVariant})</option>
                  {slot.variants.map(variant => <option key={variant.id} value={variant.id}>{variant.label}</option>)}
                </select>
                {slot.description && <p className="mt-1.5 text-xs text-zinc-500">{slot.description}</p>}
              </div>
            )
          })}
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white transition-[background-color,scale] duration-150 hover:bg-zinc-800 active:scale-96 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Save
          </button>
        </div>
      )}

      {message && (
        <p role="status" className={`mt-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${message.ok ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {message.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}{message.text}
        </p>
      )}
    </section>
  )
}
