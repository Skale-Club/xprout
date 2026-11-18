'use client'

import { BRAND_PRIMARY } from '@/lib/brand'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { MessageCircle, X, Send, Mic, Trash2, Loader2, Check, UtensilsCrossed } from 'lucide-react'
import type { Product, IngredientModifications } from '@/types/database'
import type { CartEditorState } from './menu-utils'
import { getProductImages } from './menu-utils'
import type { CartSnapshotItem, ResolvedCartItem } from '@/lib/chat-agent'
import { getGuestCopy } from './guest-copy'
import { fill, formatMoney, getMenuCopy } from './menu-i18n'
import { ctaStyle, ui } from './menu-ui'
import type { PhoneContext } from './showcase'
import { computePrimaryForeground, safeCssColor } from '@/lib/color-utils'
import PhoneField from '@/components/ui/PhoneField'
import BottomSheet from '@/components/ui/BottomSheet'
import { DeliveryImage } from '@/components/delivery-image'
import { useVisibleBox } from '@/components/ui/keyboard-fields'
import { createChatEventParser, type ChatStreamEvent } from '@/lib/chat-stream-protocol'

interface Props {
  tenantSlug: string
  tenantName: string
  /** The restaurant's stored logo URL, for the header avatar (its initial shows without one). */
  tenantLogoUrl?: string | null
  /** ISO currency of the menu, for the prices of the items the assistant added. */
  currency?: string
  primaryColor?: string
  audioEnabled?: boolean
  /** Typed messages; the restaurant may allow voice notes only. */
  textEnabled?: boolean
  products: Product[]
  onAddToCart: (product: Product, selectedOptions: Record<string, unknown>, unitPrice: number, note?: string, ingredientModifications?: IngredientModifications | null, editorState?: CartEditorState | null) => void
  /** The menu and location on screen, so the assistant answers about what the customer sees. */
  menuId?: string | null
  locationId?: string | null
  /** Whether the cart side panel is open (desktop: the chat moves left of it). */
  cartOpen?: boolean
  onOpenCart?: () => void
  /** Phone: the full-width bottom "View order" bar is showing; the launcher (bottom-left) sits above it. */
  orderBarVisible?: boolean
  /** The menu language on screen: the box's texts and the assistant's first language. */
  language?: string
  /** What is in the cart now, so the assistant does not re-add it and can suggest the rest. Each line carries its stable line_id. */
  cart?: CartSnapshotItem[] | null
  /** Sets the quantity of one cart line by its line_id (0 removes it); the assistant's updateCartItem lands here. */
  onSetCartLineQuantity?: (lineId: string, quantity: number) => void
  /** Suggested-question chips (the restaurant may switch them off). */
  suggestionsEnabled?: boolean
  /** Guests can order on this menu; off (showcase) the box only answers questions about the menu. */
  canOrder?: boolean
  /** restaurant_tables.id when the guest opened a table link. */
  tableId?: string | null
  /** The restaurant's country: the phone gate starts on its calling code. */
  phoneContext?: PhoneContext | null
  /** BCP 47 locale for country names in the phone gate. */
  locale?: string
}

// Server-side cap (MAX_USER_MESSAGE_CHARS in chat-agent.ts).
const MAX_MESSAGE_CHARS = 1000

// Voice notes stop on their own at this length, so an order can be spoken
// instead of typed without clips the transcription would struggle with.
const MAX_VOICE_SECONDS = 60
// Shorter than this is an accidental tap, not a message.
const MIN_VOICE_MS = 700

function formatSeconds(total: number): string {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

interface AddedItem {
  name: string
  quantity: number
  unitPrice: number
  image?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  cartItems?: AddedItem[]
  /** Lines of the guest's cart the assistant changed (quantity 0 = removed). */
  cartChanges?: Array<{ name: string; quantity: number }>
  /** The assistant let the staff know (waiter call). */
  staffCalled?: boolean
}

const SESSION_KEY_PREFIX = 'aiChat:'

// sm and up: the floating panel; below it, a bottom sheet.
const WIDE = '(min-width: 640px)'
function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(WIDE)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

export default function AiChatWidget({ tenantSlug, tenantName, tenantLogoUrl = null, currency = 'USD', primaryColor = BRAND_PRIMARY, audioEnabled = false, textEnabled = true, products, onAddToCart, menuId = null, locationId = null, onOpenCart, orderBarVisible = false, language = 'en', cart = null, onSetCartLineQuantity, suggestionsEnabled = true, canOrder = true, tableId = null, phoneContext = null, locale = 'en' }: Props) {
  const copy = getGuestCopy(language)
  const menuCopy = getMenuCopy(language)
  // Text and icons on the brand colour: black or white, whichever reads (never a fixed one).
  const brand = safeCssColor(primaryColor, '#18181b')
  const onBrand = computePrimaryForeground(brand)
  // Phones: the sheet lives in what the keyboard leaves visible, so the input bar sits right above it.
  const box = useVisibleBox()
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => false)
  const money = (v: number) => formatMoney(v, currency, language)
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [phoneSubmitting, setPhoneSubmitting] = useState(false)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  /** The assistant message whose text is still arriving (hides the typing dots). */
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [transcribing, setTranscribing] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordStartedRef = useRef(0)
  const discardRecordingRef = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)

  // Never leave the microphone on when the widget goes away.
  useEffect(() => () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  // Restore session from storage
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = sessionStorage.getItem(SESSION_KEY_PREFIX + tenantSlug)
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed?.conversation_id && parsed?.phone) {
          setPhone(parsed.phone)
          setConversationId(parsed.conversation_id)
        }
      } catch { /* ignore */ }
    }
  }, [tenantSlug])

  // Show what the server kept of this conversation (once per conversation id).
  // A 4xx means the conversation is gone or blocked: forget it so the phone gate shows again.
  const historyLoadedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!conversationId || historyLoadedFor.current === conversationId) return
    historyLoadedFor.current = conversationId
    ;(async () => {
      try {
        const res = await fetch(`/api/public/chat/${tenantSlug}/history?conversation_id=${encodeURIComponent(conversationId)}`)
        if (historyLoadedFor.current !== conversationId) return
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          try { sessionStorage.removeItem(SESSION_KEY_PREFIX + tenantSlug) } catch { /* ignore */ }
          historyLoadedFor.current = null
          setConversationId(null)
          return
        }
        if (!res.ok) return
        const data = await res.json() as { messages?: Array<{ role: string; content: string }> }
        const past: Message[] = (data.messages ?? [])
          .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content)
          .map((m) => ({ id: crypto.randomUUID(), role: m.role as 'user' | 'assistant', content: m.content }))
        // Anything sent while the request was in flight stays after the stored turns.
        if (past.length) setMessages((prev) => [...past, ...prev])
      } catch { /* the greeting shows as before */ }
    })()
  }, [conversationId, tenantSlug])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, sending, open, conversationId])

  async function handlePhoneSubmit() {
    if (!phone.trim()) return
    setPhoneSubmitting(true)
    setPhoneError(null)
    const res = await fetch(`/api/public/chat/${tenantSlug}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone.trim() }),
    })
    setPhoneSubmitting(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setPhoneError(data.error || copy.couldNotStart)
      return
    }
    const data = await res.json()
    setConversationId(data.conversation_id)
    setRemaining(Math.max(0, data.rate_limit - data.messages_today))
    sessionStorage.setItem(
      SESSION_KEY_PREFIX + tenantSlug,
      JSON.stringify({ conversation_id: data.conversation_id, phone: phone.trim() }),
    )
    // No stored welcome: an empty conversation shows the greeting (client-side only).
  }

  /** `voiceToken` marks a transcript signed by the audio route (needed when typing is off). */
  async function sendMessage(text: string, voiceToken?: string) {
    if (!text.trim() || !conversationId || sending) return
    setError(null)
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
    // Functional update: a voice note calls this from the recorder's callback.
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setSending(true)

    type ChatReply = { text: string; cart_items?: ResolvedCartItem[]; cart_changes?: Array<{ line_id: string; quantity: number }>; staff_called?: boolean; remaining_today: number }
    const assistantId = crypto.randomUUID()
    let data: ChatReply
    try {
      const res = await fetch(`/api/public/chat/${tenantSlug}`, {
        method: 'POST',
        // The server streams the reply when asked; an older server answers plain JSON.
        headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson, application/json;q=0.9' },
        // Only the new message: the server rebuilds the history from what it stored.
        body: JSON.stringify({ conversation_id: conversationId, message: text.trim(), menu_id: menuId, location_id: locationId, table_id: tableId, voice_token: voiceToken, language, ...(cart ? { cart } : {}) }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.error || copy.somethingWrong)
        setSending(false)
        return
      }
      if ((res.headers.get('content-type') ?? '').includes('application/x-ndjson') && res.body) {
        const parser = createChatEventParser()
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let written = ''
        const outcome: { final: ChatReply | null; failure: string | null } = { final: null, failure: null }
        const handle = (event: ChatStreamEvent) => {
          if (event.type === 'delta') {
            written += event.text
            const content = written
            setStreamingId(assistantId)
            setMessages((prev) => prev.some((m) => m.id === assistantId)
              ? prev.map((m) => (m.id === assistantId ? { ...m, content } : m))
              : [...prev, { id: assistantId, role: 'assistant', content }])
          } else if (event.type === 'done') outcome.final = event
          else outcome.failure = event.error
        }
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          parser.feed(decoder.decode(value, { stream: true })).forEach(handle)
        }
        parser.flush().forEach(handle)
        if (!outcome.final) throw new Error(outcome.failure || 'stream ended early')
        data = outcome.final
      } else {
        data = await res.json() as ChatReply
      }
    } catch {
      // Whatever was written stays on screen; the turn was not confirmed.
      setError(copy.somethingWrong)
      setStreamingId(null)
      setSending(false)
      return
    }

    // Apply cart items via parent callback. Options, editor state and unit
    // price were resolved by the server from the menu, exactly as the product
    // modal would build them.
    // Changes to lines already in the cart come first (a swap is "set the old
    // line to 0, then add the new one"). Names come from the cart the widget
    // itself reported; a line that is gone by now is skipped.
    const changedLines: Array<{ name: string; quantity: number }> = []
    if (canOrder && onSetCartLineQuantity) {
      for (const change of data.cart_changes ?? []) {
        const line = cart?.find((l) => l.line_id === change.line_id)
        if (!line || !Number.isInteger(change.quantity) || change.quantity < 0) continue
        onSetCartLineQuantity(change.line_id, change.quantity)
        changedLines.push({ name: line.name, quantity: change.quantity })
      }
    }
    const addedItems: AddedItem[] = []
    // A view-only menu has no cart: nothing the server returns is added.
    for (const item of canOrder ? data.cart_items ?? [] : []) {
      const product = products.find((p) => p.id === item.product_id)
      if (product) {
        for (let i = 0; i < item.quantity; i++) {
          onAddToCart(product, item.selected_options, item.unit_price, item.note, null, item.editor_state)
        }
        addedItems.push({ name: item.name, quantity: item.quantity, unitPrice: item.unit_price, image: getProductImages(product)[0] })
      }
    }

    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: data.text,
      cartItems: addedItems.length ? addedItems : undefined,
      cartChanges: changedLines.length ? changedLines : undefined,
      staffCalled: data.staff_called === true ? true : undefined,
    }
    // Replace the in-progress message (when text streamed in) with the final one.
    setMessages((prev) => prev.some((m) => m.id === assistantId) ? prev.map((m) => (m.id === assistantId ? assistantMsg : m)) : [...prev, assistantMsg])
    setRemaining(data.remaining_today)
    setStreamingId(null)
    setSending(false)
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError(copy.micUnsupported)
      return
    }
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mr = new MediaRecorder(stream)
      audioChunksRef.current = []
      discardRecordingRef.current = false
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        const tooShort = Date.now() - recordStartedRef.current < MIN_VOICE_MS
        if (discardRecordingRef.current || tooShort) return
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' })
        await transcribeAndSend(blob)
      }
      mediaRecorderRef.current = mr
      mr.start()
      recordStartedRef.current = Date.now()
      setRecordSeconds(0)
      setRecording(true)
      recordTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordStartedRef.current) / 1000)
        setRecordSeconds(Math.min(elapsed, MAX_VOICE_SECONDS))
        if (elapsed >= MAX_VOICE_SECONDS) stopRecording()
      }, 250)
    } catch {
      setError(copy.micDenied)
    }
  }

  /** Stops the recorder; the clip is sent unless `discard`. */
  function stopRecording(discard = false) {
    discardRecordingRef.current = discard
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current)
      recordTimerRef.current = null
    }
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    setRecording(false)
  }

  // A voice note goes out like a typed message: transcribed, then sent, so a
  // customer can speak the whole order instead of typing it.
  async function transcribeAndSend(blob: Blob) {
    if (!conversationId) return
    setTranscribing(true)
    try {
      const fd = new FormData()
      fd.append('audio', blob, blob.type.includes('mp4') ? 'voice.m4a' : blob.type.includes('ogg') ? 'voice.ogg' : 'voice.webm')
      fd.append('conversation_id', conversationId)
      const res = await fetch(`/api/public/chat/${tenantSlug}/audio`, { method: 'POST', body: fd })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || copy.transcriptionFailed)
        return
      }
      const data = await res.json() as { transcript: string; voice_token?: string | null }
      // Sent exactly as transcribed: the signature covers this text.
      const transcript = data.transcript ?? ''
      if (!transcript) {
        setError(copy.heardNothing)
        return
      }
      await sendMessage(transcript, data.voice_token ?? undefined)
    } catch {
      setError(copy.transcriptionFailed)
    } finally {
      setTranscribing(false)
    }
  }

  const assistantBubble = 'rounded-2xl rounded-bl-md bg-zinc-100 px-4 py-2.5 text-[15px] leading-relaxed text-zinc-900'
  const greeting = textEnabled
    ? (canOrder ? copy.greeting : copy.greetingBrowse)
    : fill(canOrder ? copy.welcomeVoice : copy.welcomeVoiceBrowse, { name: tenantName })
  const suggestions = [copy.suggestRecommend, copy.suggestPopular, canOrder ? copy.suggestOrder : copy.suggestSpecials]

  // One body for both containers: the bottom sheet (phones) and the floating panel (sm and up).
  const content = (
    <>
      {/* Header: on phones it drags the sheet like the grabber */}
      <div data-sheet-grip={wide ? undefined : true} className={`flex shrink-0 items-center gap-3 border-b border-zinc-100 bg-white px-4 ${wide ? 'py-3.5' : 'touch-none pt-0.5 pb-3'}`}>
        <div
          className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-black ring-1 ring-black/5"
          style={tenantLogoUrl ? { backgroundColor: '#fff' } : { backgroundColor: brand, color: onBrand }}
          aria-hidden="true"
        >
          {tenantLogoUrl
            ? <DeliveryImage src={tenantLogoUrl} alt="" fill sizes="40px" className="object-contain p-1" />
            : (Array.from(tenantName.trim())[0] ?? '?').toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className={`truncate ${ui.barTitle} text-zinc-900`}>{tenantName}</h2>
          <p className="truncate text-[13px] text-zinc-500">{copy.aiAssistant}</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label={copy.close} className={ui.sheetIconButton}>
          <X className="size-4" />
        </button>
      </div>

      {/* Phone gate */}
      {!conversationId && (
        <form
          className={`flex flex-1 min-h-0 flex-col space-y-4 overflow-y-auto bg-white px-6 py-5 ${box.short ? 'justify-start' : 'justify-center'}`}
          style={{ '--accent': brand } as React.CSSProperties}
          onSubmit={(e) => { e.preventDefault(); if (!phoneSubmitting && phone.trim()) void handlePhoneSubmit() }}
        >
          <h3 className={`${ui.sheetTitle} text-zinc-900`}>{fill(copy.chatWith, { name: tenantName })}</h3>
          {!box.short && <p className="text-[15px] leading-relaxed text-zinc-600">{copy.gateBody}</p>}
          <div>
            <label htmlFor="chat-phone" className="mb-1.5 block text-[14px] font-medium text-zinc-700">{menuCopy.loginPhoneLabel}</label>
            <PhoneField
              id="chat-phone"
              value={phone}
              onChange={setPhone}
              phoneContext={phoneContext}
              locale={locale}
              countryLabel={menuCopy.loginCountry}
              countrySearchLabel={menuCopy.loginCountrySearch}
              enterKeyHint="go"
              describedBy={phoneError ? 'chat-phone-error' : undefined}
              className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-[16px] text-zinc-950 placeholder:text-zinc-500 focus:border-zinc-900 focus:outline-none focus:ring-[3px] focus:ring-zinc-900/10"
            />
          </div>
          {phoneError && <p id="chat-phone-error" role="alert" className="text-[14px] font-medium text-red-700">{phoneError}</p>}
          <button
            type="submit"
            disabled={phoneSubmitting || !phone.trim()}
            className={`${ui.cta} h-12 w-full disabled:opacity-50 disabled:shadow-none`}
            style={ctaStyle(brand, onBrand)}
          >
            {phoneSubmitting ? copy.starting : copy.startChat}
          </button>
        </form>
      )}

      {/* Conversation */}
      {conversationId && (
        <>
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-white px-4 py-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-start gap-3">
                <div className={`max-w-[88%] ${assistantBubble}`}>
                  <p className="whitespace-pre-wrap">{greeting}</p>
                </div>
                {textEnabled && suggestionsEnabled && (
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((text) => (
                      <button
                        key={text}
                        type="button"
                        disabled={sending}
                        onClick={() => void sendMessage(text)}
                        className="min-h-10 rounded-full border border-zinc-200 bg-white px-4 py-2 text-left text-[14px] font-medium text-zinc-800 transition-colors hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-50"
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                {m.role === 'user' ? (
                  <div
                    className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] leading-relaxed"
                    style={{ backgroundColor: brand, color: onBrand }}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                ) : (
                  <div className="flex w-full max-w-[88%] flex-col items-start gap-2">
                    {m.content && (
                      <div className={assistantBubble}>
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>
                    )}
                    {m.staffCalled && (
                      <div role="status" className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-[14px] font-semibold text-emerald-700 ring-1 ring-zinc-200">
                        <Check className="size-4" aria-hidden="true" />
                        {copy.staffNotified}
                      </div>
                    )}
                    {m.cartChanges && m.cartChanges.length > 0 && (
                      <ul className="flex w-full flex-col gap-2">
                        {m.cartChanges.map((change, i) => (
                          <li key={i} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 ring-1 ring-zinc-200">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[14px] font-semibold text-zinc-900">{change.name}</p>
                              {change.quantity > 0 && <p className="text-[13px] text-zinc-600 tabular-nums">× {change.quantity}</p>}
                            </div>
                            <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-emerald-700">
                              <Check className="size-3.5" aria-hidden="true" />
                              {change.quantity > 0 ? copy.cartUpdatedLabel : copy.cartRemovedLabel}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {m.cartItems && m.cartItems.length > 0 && (
                      <ul className="flex w-full flex-col gap-2">
                        {m.cartItems.map((ci, i) => (
                          <li key={i} className="flex items-center gap-3 rounded-2xl bg-white p-2 pr-3 ring-1 ring-zinc-200">
                            <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                              {ci.image
                                ? <DeliveryImage variant="card" src={ci.image} alt="" fill sizes="48px" className="object-cover" />
                                : <div className="flex size-full items-center justify-center"><UtensilsCrossed className="size-4 text-zinc-300" aria-hidden="true" /></div>}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[14px] font-semibold text-zinc-900">{ci.name}</p>
                              <p className="text-[13px] text-zinc-600 tabular-nums">{ci.quantity} × {money(ci.unitPrice)}</p>
                            </div>
                            <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-emerald-700">
                              <Check className="size-3.5" aria-hidden="true" />
                              {copy.addedLabel}
                            </span>
                          </li>
                        ))}
                        {onOpenCart && (
                          <li>
                            <button
                              type="button"
                              onClick={onOpenCart}
                              className={`${ui.ctaQuiet} h-10 bg-zinc-100 text-zinc-800 hover:bg-zinc-200`}
                            >
                              {copy.viewCart}
                            </button>
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
            {sending && !streamingId && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-zinc-100 px-4 py-3.5" role="status" aria-label={copy.sending}>
                  <div className="flex gap-1">
                    <span className="size-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: '0ms' }} />
                    <span className="size-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: '150ms' }} />
                    <span className="size-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[14px] font-medium text-red-800">
                {error}
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="shrink-0 border-t border-zinc-100 bg-white px-3 py-3">
            {remaining !== null && remaining <= 5 && (
              <p className="mb-1.5 px-1 text-[12px] font-bold text-amber-800">{fill(copy.remainingToday, { n: remaining })}</p>
            )}
            {recording ? (
              <div className="flex items-center gap-2" role="status" aria-live="polite">
                <button
                  type="button"
                  onClick={() => stopRecording(true)}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  aria-label={copy.discardRecording}
                >
                  <Trash2 className="size-4" />
                </button>
                <div className="min-w-0 flex-1 rounded-2xl border border-red-100 bg-red-50 px-3 py-2">
                  <div className="flex items-center gap-2 text-sm font-semibold tabular-nums text-red-700">
                    <span className="size-2 animate-pulse rounded-full bg-red-500" aria-hidden="true" />
                    {formatSeconds(recordSeconds)}
                    <span className="font-medium text-red-400">/ {formatSeconds(MAX_VOICE_SECONDS)}</span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-red-100">
                    <div className="h-full bg-red-500 transition-[width] duration-200" style={{ width: `${(recordSeconds / MAX_VOICE_SECONDS) * 100}%` }} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => stopRecording()}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: brand, color: onBrand }}
                  aria-label={copy.stopAndSend}
                >
                  <Send className="size-4" />
                </button>
              </div>
            ) : !textEnabled ? (
              <button
                type="button"
                onClick={startRecording}
                disabled={sending || transcribing || !audioEnabled}
                className={`${ui.cta} h-12 w-full disabled:opacity-60 disabled:shadow-none`}
                style={ctaStyle(brand, onBrand)}
              >
                {transcribing ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
                {transcribing ? copy.transcribing : sending ? copy.sending : fill(copy.tapToRecord, { s: MAX_VOICE_SECONDS })}
              </button>
            ) : (
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void sendMessage(input)
                    }
                  }}
                  rows={1}
                  maxLength={MAX_MESSAGE_CHARS}
                  enterKeyHint="send"
                  aria-label={copy.askMenu}
                  placeholder={transcribing ? copy.transcribing : audioEnabled && canOrder ? copy.typeOrRecord : copy.askMenu}
                  disabled={sending || transcribing}
                  className="max-h-24 min-h-11 flex-1 resize-none rounded-3xl border border-transparent bg-zinc-100 px-4 py-2.5 text-[16px] leading-6 text-zinc-950 placeholder:text-zinc-500 focus:border-zinc-900 focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-zinc-900/10 disabled:opacity-60"
                />
                {audioEnabled && (
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={sending || transcribing}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition-colors hover:bg-zinc-200 disabled:opacity-50"
                    aria-label={fill(copy.recordVoice, { s: MAX_VOICE_SECONDS })}
                    title={fill(copy.recordVoice, { s: MAX_VOICE_SECONDS })}
                  >
                    {transcribing ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void sendMessage(input)}
                  disabled={sending || !input.trim() || transcribing}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full transition-[scale,opacity] active:scale-95 disabled:opacity-40"
                  style={{ backgroundColor: brand, color: onBrand }}
                  aria-label={copy.send}
                >
                  <Send className="size-4" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={`fixed ${orderBarVisible ? 'bottom-24 sm:bottom-6' : 'bottom-6'} left-6 z-40 w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-transform hover:scale-105`}
          style={{ backgroundColor: brand, color: onBrand }}
          aria-label={copy.openChat}
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Phones: bottom sheet (medium, drag up for large). The body keeps a tall basis so the sheet always fills its detent. */}
      {!wide && (
        <BottomSheet
          open={open}
          onClose={() => setOpen(false)}
          detents="medium-large"
          ariaLabel={fill(copy.askName, { name: tenantName })}
          zIndexClassName="z-50"
          frameStyle={box.style}
          expandLabel={copy.expandChat}
          shrinkLabel={copy.shrinkChat}
        >
          <div className="flex min-h-0 flex-1 flex-col" style={{ flexBasis: '100dvh' }}>
            {content}
          </div>
        </BottomSheet>
      )}

      {/* sm and up: floating panel, bottom-left */}
      {wide && open && (
        <div
          role="dialog"
          aria-label={fill(copy.askName, { name: tenantName })}
          className="fixed bottom-6 left-6 z-50 flex h-[640px] max-h-[80vh] w-[400px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
        >
          {content}
        </div>
      )}
    </>
  )
}
