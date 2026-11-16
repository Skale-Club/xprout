'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import { Tag, Plus, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type PromoCode = {
  id: string; code: string; kind: 'percent' | 'fixed'; value: number
  starts_at: string | null; ends_at: string | null; is_active: boolean; created_at: string
}

const inputClassName = 'w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-950 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary'
const labelClassName = 'block text-[14px] font-semibold text-zinc-700 mb-1.5 ml-1'

const describe = (promo: PromoCode) => promo.kind === 'percent' ? `${promo.value}% off` : `${(promo.value / 100).toFixed(2)} off`
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : null)

/** A local calendar day as an ISO instant: the start of it, or its last second. */
function localDay(value: string, end: boolean) {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  return (end ? new Date(y, m - 1, d, 23, 59, 59) : new Date(y, m - 1, d, 0, 0, 0)).toISOString()
}

export default function PromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [ready, setReady] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ code: '', kind: 'percent' as 'percent' | 'fixed', value: '', starts: '', ends: '' })

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/promo-codes')
      const data = await response.json().catch(() => ({})) as { codes?: PromoCode[]; ready?: boolean; error?: string }
      if (!response.ok) setError(data.error ?? 'Could not load promo codes')
      else { setCodes(data.codes ?? []); setReady(data.ready !== false) }
    } catch { setError('Could not load promo codes') }
    setLoaded(true)
  }, [])

  useEffect(() => { void load() }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const amount = Number(form.value.replace(',', '.'))
    const value = form.kind === 'percent' ? amount : Math.round(amount * 100)
    if (!Number.isFinite(amount) || !Number.isInteger(value)) { setError('Enter a valid discount'); return }
    setSaving(true)
    try {
      const response = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: form.code, kind: form.kind, value, starts_at: localDay(form.starts, false), ends_at: localDay(form.ends, true) }),
      })
      const data = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) setError(data.error ?? 'Could not create the promo code')
      else { setForm({ code: '', kind: 'percent', value: '', starts: '', ends: '' }); await load() }
    } catch { setError('Could not create the promo code') }
    setSaving(false)
  }

  async function deactivate(id: string) {
    setError(null)
    try {
      const response = await fetch('/api/admin/promo-codes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: false }),
      })
      const data = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) setError(data.error ?? 'Could not deactivate the promo code')
      else await load()
    } catch { setError('Could not deactivate the promo code') }
  }

  return (
    <div className="p-8 w-full space-y-10 max-w-3xl">
      <div className="pb-6 border-b border-zinc-100">
        <div className="flex items-center gap-2 mb-2">
          <Tag className="w-5 h-5 text-primary" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Administration</span>
        </div>
        <h1 className="text-4xl font-black text-zinc-950 tracking-tight">Promo codes</h1>
        <p className="text-sm font-bold text-zinc-500 mt-1">Guests enter a code at checkout. One code per order; it reduces the items subtotal only.</p>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}

      {loaded && !ready && (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700">Promo codes are not available yet.</p>
      )}

      {ready && (
        <form onSubmit={create} className="bg-white border border-zinc-100 rounded-[1.25rem] p-8 space-y-4 shadow-sm">
          <h2 className="text-xl font-black text-zinc-950 tracking-tight">New code</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClassName}>Code</label>
              <input className={inputClassName} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} maxLength={32} placeholder="WELCOME10" required />
            </div>
            <div>
              <label className={labelClassName}>Type</label>
              <select className={inputClassName} value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value as 'percent' | 'fixed' }))}>
                <option value="percent">Percent off</option>
                <option value="fixed">Fixed amount off</option>
              </select>
            </div>
            <div>
              <label className={labelClassName}>{form.kind === 'percent' ? 'Percent (1-100)' : 'Amount (e.g. 5.00)'}</label>
              <input className={inputClassName} inputMode="decimal" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder={form.kind === 'percent' ? '10' : '5.00'} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClassName}>Starts (optional)</label>
                <input type="date" className={inputClassName} value={form.starts} onChange={e => setForm(f => ({ ...f, starts: e.target.value }))} />
              </div>
              <div>
                <label className={labelClassName}>Ends (optional)</label>
                <input type="date" className={inputClassName} value={form.ends} onChange={e => setForm(f => ({ ...f, ends: e.target.value }))} />
              </div>
            </div>
          </div>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
            <Plus className="w-4 h-4" /> {saving ? 'Creating...' : 'Create code'}
          </button>
        </form>
      )}

      {ready && loaded && (
        <div className="bg-white border border-zinc-100 rounded-[1.25rem] shadow-sm divide-y divide-zinc-100">
          {codes.length === 0 && <p className="p-8 text-sm font-medium text-zinc-500">No promo codes yet.</p>}
          {codes.map(promo => (
            <div key={promo.id} className="flex items-center justify-between gap-4 p-5">
              <div className="min-w-0">
                <p className={cn('font-black tracking-wide', promo.is_active ? 'text-zinc-950' : 'text-zinc-400 line-through')}>{promo.code}</p>
                <p className="text-[13px] font-medium text-zinc-500">
                  {describe(promo)}
                  {promo.starts_at ? ` · from ${day(promo.starts_at)}` : ''}
                  {promo.ends_at ? ` · until ${day(promo.ends_at)}` : ''}
                </p>
              </div>
              {promo.is_active
                ? <button type="button" onClick={() => deactivate(promo.id)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-[13px] font-semibold text-zinc-700 hover:border-zinc-300">Deactivate</button>
                : <span className="text-[12px] font-bold uppercase tracking-widest text-zinc-400">Inactive</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
