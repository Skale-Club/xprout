'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Bot, Sparkles, Mic, MessageSquare, ShoppingCart, BellRing, Lightbulb, History, AlertCircle, CheckCircle2, Save, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CHAT_MODELS, resolveChatModel } from '@/lib/ai/chat-models'

const MODELS = CHAT_MODELS

interface Status {
  available: boolean
  active: boolean
  enabled: boolean
  overrideApplied: boolean
}

interface Settings {
  enabled: boolean
  openrouter_model: string
  audio_enabled: boolean
  text_enabled: boolean
  ordering_help_enabled: boolean
  staff_call_enabled: boolean
  suggestions_enabled: boolean
  history_enabled: boolean
  audio_provider: 'whisper' | 'deepgram' | null
  rate_limit_per_phone_per_day: number
}

/** What the plan and the restaurant's switches allow (TenantCapabilities.guestOrdering / waiterCalls). */
interface AbilityAccess {
  guestOrdering: boolean
  waiterCalls: boolean
}

export default function ChatAddonClient({ initialSettings, status, abilityAccess }: { initialSettings: any; status: Status; abilityAccess: AbilityAccess }) {
  const [form, setForm] = useState<Settings>({
    enabled: initialSettings?.enabled ?? false,
    openrouter_model: resolveChatModel(initialSettings?.openrouter_model),
    audio_enabled: initialSettings?.audio_enabled ?? false,
    text_enabled: initialSettings?.text_enabled ?? true,
    ordering_help_enabled: initialSettings?.ordering_help_enabled ?? true,
    staff_call_enabled: initialSettings?.staff_call_enabled ?? true,
    suggestions_enabled: initialSettings?.suggestions_enabled ?? true,
    history_enabled: initialSettings?.history_enabled ?? true,
    audio_provider: initialSettings?.audio_provider ?? 'whisper',
    rate_limit_per_phone_per_day: initialSettings?.rate_limit_per_phone_per_day ?? 30,
  })

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const res = await fetch('/api/admin/chat-addon/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  const canPurchase = !status.available
  const planActive = status.available && !status.overrideApplied && !status.active

  return (
    <div className="p-8 w-full space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-zinc-100">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Administration</span>
          </div>
          <h1 className="text-4xl font-black text-zinc-950 tracking-tight">AI Chat</h1>
          <p className="text-sm font-bold text-zinc-500 mt-1">Embed a menu-aware AI assistant on your public page</p>
        </div>
        <div>
          {status.active ? (
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full text-xs font-black text-green-700 uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Addon Active
            </span>
          ) : canPurchase ? (
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full text-xs font-black text-amber-700 uppercase tracking-widest">
              <Sparkles className="w-3 h-3" /> Upgrade required
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-full text-xs font-black text-zinc-500 uppercase tracking-widest">
              Addon inactive
            </span>
          )}
        </div>
      </div>

      {/* Upgrade banner */}
      {canPurchase && (
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-[1.25rem] p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-lg font-black text-zinc-950 mb-1">Activate AI Chat — $20/month</p>
            <p className="text-sm text-zinc-700">A menu-aware assistant that helps customers explore your dishes, recommend pairings, and add items to their cart.</p>
          </div>
          <a
            href="/api/admin/chat-addon/billing/checkout"
            className="px-6 py-3 bg-zinc-950 text-white rounded-full text-sm font-black uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all whitespace-nowrap"
          >
            Activate Addon
          </a>
        </div>
      )}

      {planActive && (
        <div className="bg-blue-50 border border-blue-200 rounded-[1.25rem] p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-bold">Your plan includes AI Chat.</p>
            <p>Activate the addon below to start using it.</p>
          </div>
        </div>
      )}

      {/* Settings — only editable when active */}
      <div className={cn("bg-white border border-zinc-100 rounded-[1.25rem] p-10 space-y-8 shadow-sm", !status.available && "opacity-60 pointer-events-none")}>
        {/* Enable toggle */}
        <div
          className="flex items-center justify-between p-5 rounded-[1rem] bg-zinc-50 hover:bg-zinc-100 transition-all cursor-pointer"
          onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
        >
          <div className="max-w-[70%]">
            <p className="text-sm font-black text-zinc-950 uppercase tracking-tight">Enable chat widget</p>
            <p className="text-[10px] text-zinc-500 font-medium leading-relaxed mt-0.5">Show the floating chat button on your public menu pages.</p>
          </div>
          <button type="button" className={cn(
            "relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none",
            form.enabled ? "bg-primary" : "bg-zinc-200"
          )}>
            <span className={cn(
              "inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-300",
              form.enabled ? "translate-x-5" : "translate-x-1"
            )} />
          </button>
        </div>

        {/* OpenRouter config */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wide">OpenRouter</h3>

          <Link
            href="/settings/ai"
            className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4 transition-colors hover:bg-zinc-100"
          >
            <span>
              <span className="block text-sm font-black text-zinc-950">AI key & billing</span>
              <span className="block text-[11px] text-zinc-500 mt-0.5">Use your own OpenRouter key, or let usage go on your plan invoice.</span>
            </span>
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          </Link>

          <div>
            <label className="block text-[14px] font-semibold text-zinc-700 mb-2 ml-1">Model</label>
            <select
              value={form.openrouter_model}
              onChange={e => setForm(f => ({ ...f, openrouter_model: e.target.value }))}
              className="w-full px-5 py-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[14px] font-semibold text-zinc-700 mb-2 ml-1">Rate limit (messages per phone per day)</label>
            <input
              type="number"
              min={1}
              max={500}
              value={form.rate_limit_per_phone_per_day}
              onChange={e => setForm(f => ({ ...f, rate_limit_per_phone_per_day: Math.max(1, Math.min(500, Number(e.target.value) || 30)) }))}
              className="w-full px-5 py-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-[13px] text-zinc-600 mt-2 ml-1">Per-phone, rolling 24-hour window.</p>
          </div>
        </div>

        {/* Channels: how guests may talk to the assistant */}
        <div className="space-y-4 pt-4 border-t border-zinc-100">
          <div
            className="flex items-center justify-between p-5 rounded-[1rem] bg-zinc-50 hover:bg-zinc-100 transition-all cursor-pointer"
            onClick={() => setForm(f => ({ ...f, text_enabled: !f.text_enabled }))}
          >
            <div className="max-w-[70%]">
              <p className="text-sm font-black text-zinc-950 uppercase tracking-tight flex items-center gap-2"><MessageSquare className="w-4 h-4" />Text messages</p>
              <p className="text-[10px] text-zinc-500 font-medium leading-relaxed mt-0.5">Customers can type to the assistant. Turn off to take voice messages only.</p>
            </div>
            <button type="button" aria-pressed={form.text_enabled} aria-label="Text messages" className={cn(
              "relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none",
              form.text_enabled ? "bg-primary" : "bg-zinc-200"
            )}>
              <span className={cn(
                "inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-300",
                form.text_enabled ? "translate-x-5" : "translate-x-1"
              )} />
            </button>
          </div>

          <div
            className="flex items-center justify-between p-5 rounded-[1rem] bg-zinc-50 hover:bg-zinc-100 transition-all cursor-pointer"
            onClick={() => setForm(f => ({ ...f, audio_enabled: !f.audio_enabled }))}
          >
            <div className="max-w-[70%]">
              <p className="text-sm font-black text-zinc-950 uppercase tracking-tight flex items-center gap-2"><Mic className="w-4 h-4" />Voice messages (STT)</p>
              <p className="text-[10px] text-zinc-500 font-medium leading-relaxed mt-0.5">Customers can speak their order instead of typing: voice notes up to 60 seconds, transcribed and answered in text.</p>
            </div>
            <button type="button" aria-pressed={form.audio_enabled} aria-label="Voice messages" className={cn(
              "relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none",
              form.audio_enabled ? "bg-primary" : "bg-zinc-200"
            )}>
              <span className={cn(
                "inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-300",
                form.audio_enabled ? "translate-x-5" : "translate-x-1"
              )} />
            </button>
          </div>

          {form.audio_enabled && (
            <div className="space-y-4 px-5">
              <div>
                <label className="block text-[14px] font-semibold text-zinc-700 mb-2 ml-1">Transcription model</label>
                <select
                  value={form.audio_provider ?? 'whisper'}
                  onChange={e => setForm(f => ({ ...f, audio_provider: e.target.value === 'deepgram' ? 'deepgram' : 'whisper' }))}
                  className="w-full px-5 py-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="whisper">OpenAI Whisper</option>
                  <option value="deepgram">Deepgram Nova</option>
                </select>
                <p className="text-[13px] text-zinc-600 mt-2 ml-1">Runs on the same AI setup as the chat (AI key & billing). No separate audio key.</p>
              </div>
            </div>
          )}
        </div>

        {/* Abilities: what the assistant may do. Off = the tool is not offered to the model at all. */}
        <div className="space-y-4 pt-4 border-t border-zinc-100">
          <AbilityToggle
            icon={<ShoppingCart className="w-4 h-4" />}
            label="Help guests order (add, remove, change items)"
            description="The assistant can put dishes in the guest's cart and change quantities. The guest still reviews the cart and checks out."
            checked={form.ordering_help_enabled && abilityAccess.guestOrdering}
            disabled={!abilityAccess.guestOrdering}
            hint="Needs guest ordering: turn on online ordering in Settings › Store (Orders plan)."
            onChange={() => setForm(f => ({ ...f, ordering_help_enabled: !f.ordering_help_enabled }))}
          />
          <AbilityToggle
            icon={<BellRing className="w-4 h-4" />}
            label="Call staff from the chat (table links)"
            description="When a guest on a table link asks for a waiter or the bill, the assistant notifies your staff, like the Call waiter button."
            checked={form.staff_call_enabled && abilityAccess.waiterCalls}
            disabled={!abilityAccess.waiterCalls}
            hint="Needs calls from the table: tables and ordering on your plan, with table links in use."
            onChange={() => setForm(f => ({ ...f, staff_call_enabled: !f.staff_call_enabled }))}
          />
          <AbilityToggle
            icon={<Lightbulb className="w-4 h-4" />}
            label="Suggested questions"
            description="Shows quick question buttons when a guest opens an empty chat."
            checked={form.suggestions_enabled}
            onChange={() => setForm(f => ({ ...f, suggestions_enabled: !f.suggestions_enabled }))}
          />
          <AbilityToggle
            icon={<History className="w-4 h-4" />}
            label="Keep guests' chat history (turn off for a shared tablet)"
            description="Off: every session starts from zero (the chat clears on close, reload and after 5 idle minutes). Your inbox keeps the conversations either way."
            checked={form.history_enabled}
            onChange={() => setForm(f => ({ ...f, history_enabled: !f.history_enabled }))}
          />
        </div>

        {!form.text_enabled && !form.audio_enabled && (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            Text and voice messages are both off, so the chat box will not show on your menu.
          </p>
        )}

        {/* Save */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "flex items-center gap-3 px-12 py-4 rounded-full text-sm font-black uppercase tracking-widest transition-all",
              saved ? "bg-green-500 text-white" : "bg-zinc-950 text-primary hover:bg-primary hover:text-primary-foreground"
            )}
          >
            {saving ? 'Saving…' : saved ? (<><CheckCircle2 className="w-5 h-5" />Saved</>) : (<><Save className="w-5 h-5" />Save settings</>)}
          </button>
        </div>
      </div>
    </div>
  )
}

function AbilityToggle({ icon, label, description, checked, disabled = false, hint, onChange }: {
  icon: ReactNode
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  /** Why the switch is unavailable (shown only when disabled). */
  hint?: string
  onChange: () => void
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-5 rounded-[1rem] bg-zinc-50 transition-all",
        disabled ? "opacity-60" : "hover:bg-zinc-100 cursor-pointer"
      )}
      onClick={disabled ? undefined : onChange}
    >
      <div className="max-w-[70%]">
        <p className="text-sm font-black text-zinc-950 uppercase tracking-tight flex items-center gap-2">{icon}{label}</p>
        <p className="text-[10px] text-zinc-500 font-medium leading-relaxed mt-0.5">{disabled && hint ? hint : description}</p>
      </div>
      <button type="button" aria-pressed={checked} aria-label={label} disabled={disabled} className={cn(
        "relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none",
        checked ? "bg-primary" : "bg-zinc-200"
      )}>
        <span className={cn(
          "inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-300",
          checked ? "translate-x-5" : "translate-x-1"
        )} />
      </button>
    </div>
  )
}
