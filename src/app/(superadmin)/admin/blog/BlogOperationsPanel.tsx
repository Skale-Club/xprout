'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react'

interface StuckOperation {
  id: string
  tenantId: string | null
  kind: string
  status: string
  outcomeCode: string | null
  createdAt: string | null
}

const API = '/api/superadmin/blog/operations'

/**
 * Blog operations that never finished (still running past their window, or waiting for reconcile). While one is
 * open it blocks that blog's next generation; closing it as failed lets the client (or the platform) try again.
 */
export default function BlogOperationsPanel({ card }: { card: string }) {
  const [operations, setOperations] = useState<StuckOperation[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const apply = useCallback((ok: boolean, json: { error?: string; operations?: unknown } | null) => {
    if (!ok) { setError(json?.error ?? 'Não foi possível carregar as operações.'); setOperations([]); return }
    setOperations(Array.isArray(json?.operations) ? json.operations as StuckOperation[] : [])
  }, [])
  const load = useCallback(async () => {
    const res = await fetch(API, { cache: 'no-store' }).catch(() => null)
    apply(!!res?.ok, res ? await res.json().catch(() => null) : null)
  }, [apply])

  useEffect(() => {
    let active = true
    fetch(API, { cache: 'no-store' })
      .then(async res => { const json = await res.json().catch(() => null); if (active) apply(res.ok, json) })
      .catch(() => { if (active) apply(false, null) })
    return () => { active = false }
  }, [apply])

  async function close(id: string) {
    setBusy(id)
    setError(null)
    const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operationId: id }) }).catch(() => null)
    const json = res ? await res.json().catch(() => null) : null
    setBusy(null)
    if (!res?.ok) { setError(json?.error ?? 'Não foi possível encerrar a operação.'); return }
    await load()
  }

  return (
    <section className={`${card} space-y-4`}>
      <div>
        <h2 className="text-lg font-bold text-zinc-950">Operações travadas</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Gerações ou envios que não terminaram. Enquanto uma estiver aberta, aquele blog não gera outro post. Encerrar como falha libera uma nova tentativa.
        </p>
      </div>
      {error && <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"><AlertTriangle className="size-4 shrink-0" />{error}</p>}
      {operations === null ? (
        <p className="flex items-center gap-2 text-sm text-zinc-500"><Loader2 className="size-4 animate-spin" />Carregando…</p>
      ) : operations.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma operação travada.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
          {operations.map(op => (
            <li key={op.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-zinc-900">{op.kind} · <span className="font-normal text-zinc-600">{op.status === 'reconcile' ? 'aguardando conferência' : 'em andamento'}</span></p>
                <p className="text-xs text-zinc-500">
                  {op.tenantId ? `Cliente ${op.tenantId.slice(0, 8)}` : 'Blog da plataforma'}
                  {op.createdAt ? ` · desde ${new Date(op.createdAt).toLocaleString('pt-BR')}` : ''}
                  {op.outcomeCode ? ` · ${op.outcomeCode}` : ''}
                </p>
              </div>
              <button type="button" onClick={() => void close(op.id)} disabled={busy !== null}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-200 px-4 text-sm font-bold text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50">
                {busy === op.id ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}Encerrar como falha
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
