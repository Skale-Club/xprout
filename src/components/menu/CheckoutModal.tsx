'use client'

import Image from 'next/image'
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { X, ChevronLeft, Check, UtensilsCrossed, Package, Truck, MapPin } from 'lucide-react'
import type { CartItem } from './menu-utils'
import { getProductImages, summarizeOptions, summarizeIngredientMods } from './menu-utils'
import { fill, formatMoney, getMenuCopy } from './menu-i18n'
import type { DeliveryZone } from '@/types/database'
import { computePrimaryForeground } from '@/lib/color-utils'
import BottomSheet from '@/components/ui/BottomSheet'
import PhoneField from '@/components/ui/PhoneField'
import { keepFieldVisible, nextFieldOnEnter, useVisibleBox } from '@/components/ui/keyboard-fields'
import type { PhoneContext } from './showcase'
import { ctaStyle, ui } from './menu-ui'
import { asapBlockedReason, generateSlots, groupSlotsByDay, localDayKey, type Hours } from '@/lib/orders/scheduled-orders'
import { formatSlotDay, formatSlotTime } from './schedule-format'
import { deliveryRuleViolation } from '@/lib/orders/delivery-rules'
import { discountCents as promoDiscountCents, taxCents as salesTaxCents, type PromoKind } from '@/lib/orders/tax-promo'

/** What checkout needs to offer Schedule for later: the hours, the zone and the cart's notice. */
export type CheckoutScheduling = { hours: Hours; timeZone: string; prepMinutes: number; maxNoticeMinutes: number }

/** A promo code the server accepted, kept to preview its discount; the order only carries the code. */
export type AppliedPromo = { code: string; kind: PromoKind; value: number }

function findMatchingZone(zipcode: string | undefined, zones: DeliveryZone[] | undefined): DeliveryZone | null {
  if (!zipcode || !zones || zones.length === 0) return null
  const clean = zipcode.trim().replace(/\D/g, '')
  if (!clean) return null
  return zones.find(z => z.is_active && z.zipcode_prefixes.some(p => clean.startsWith(p))) ?? null
}

/**
 * Checkout: one calm column — what you're ordering, how you want it, your
 * details, the totals — with "Place order · total" pinned at the bottom.
 * In the iOS-style BottomSheet on every screen size, as tall as its content. Item editing
 * happens in CartPanel. The sheet lives in the part of the screen the phone
 * keyboard leaves visible, so the field being typed in and the button stay
 * above the keys; Enter moves to the next field and, in the last one, places
 * the order.
 */
export default function CheckoutModal({ cart, confirmedCart, currency, lang, customerName, customerPhone, submittingOrder, orderSuccess, orderError, orderId, primaryColor, orderTypeConfig, tableName = null, orderType, deliveryStreet, deliveryComplement, deliveryZipcode, deliveryCity, deliveryNotes, deliveryZones, deliveryZonesOnly = false, tipsEnabled, tipPercentages, tipCents, onTipChange, tenantId, taxBps = 0, promoEnabled = false, promo = null, onPromoChange, scheduling = null, scheduledFor = null, onScheduledForChange, confirmedScheduledFor = null, phoneContext = null, locale = 'en', restaurantName = '', contact = { email: '', smsOptIn: false, emailOptIn: false }, onContactChange, onOrderTypeChange, onDeliveryFieldChange, onClose, onBack, onCustomerNameChange, onCustomerPhoneChange, onSubmit }: {
  cart: CartItem[]
  confirmedCart: CartItem[]
  currency: string
  lang: string
  customerName: string
  customerPhone: string
  submittingOrder: boolean
  orderSuccess: boolean
  orderError: string | null
  orderId: string | null
  primaryColor?: string
  orderTypeConfig?: { dineIn: boolean; pickup: boolean; delivery: boolean; deliveryFeeCents: number }
  /** Ordering from a table link: the order goes to this table. */
  tableName?: string | null
  orderType?: string
  deliveryStreet?: string
  deliveryComplement?: string
  deliveryZipcode?: string
  deliveryCity?: string
  deliveryNotes?: string
  deliveryZones?: DeliveryZone[]
  /** Own delivery only inside the zones (needs the delivery-rules schema step). */
  deliveryZonesOnly?: boolean
  tipsEnabled?: boolean
  tipPercentages?: [number, number, number]
  tipCents?: number
  onTipChange?: (cents: number) => void
  /** Sales tax (basis points) and the promo code field: only guest checkout with the schema in place. */
  tenantId?: string
  taxBps?: number
  promoEnabled?: boolean
  promo?: AppliedPromo | null
  onPromoChange?: (promo: AppliedPromo | null) => void
  /** Scheduled orders: only guest checkout with the schema in place and the restaurant's switch on. */
  scheduling?: CheckoutScheduling | null
  /** The chosen time (epoch ms), or null for ASAP. */
  scheduledFor?: number | null
  onScheduledForChange?: (ms: number | null) => void
  /** The time the order just placed was scheduled for (shown instead of the ready-in estimate). */
  confirmedScheduledFor?: number | null
  /** The restaurant's country: the phone field starts on its calling code. */
  phoneContext?: PhoneContext | null
  /** BCP 47 locale for country names in the phone field. */
  locale?: string
  restaurantName?: string
  /** Optional receipt email and the two marketing opt-ins (never pre-ticked). */
  contact?: { email: string; smsOptIn: boolean; emailOptIn: boolean }
  onContactChange?: (patch: Partial<{ email: string; smsOptIn: boolean; emailOptIn: boolean }>) => void
  onOrderTypeChange?: (t: string) => void
  onDeliveryFieldChange?: (field: 'street' | 'complement' | 'zipcode' | 'city' | 'notes', value: string) => void
  onClose: () => void
  onBack: () => void
  onCustomerNameChange: (name: string) => void
  onCustomerPhoneChange: (phone: string) => void
  onSubmit: () => void
}) {
  const [selectedTipKey, setSelectedTipKey] = useState<'pct1' | 'pct2' | 'pct3' | 'custom' | null>(null)
  const [customTipValue, setCustomTipValue] = useState('')
  const [promoInput, setPromoInput] = useState('')
  const [promoState, setPromoState] = useState<'idle' | 'checking' | 'invalid'>('idle')
  const copy = getMenuCopy(lang)
  // A marketing channel can be ticked only once the guest gave it.
  const hasPhone = customerPhone.replace(/\D/g, '').length >= 7
  const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.email.trim())
  const money = (value: number) => formatMoney(value, currency, lang)
  const primary = primaryColor ?? '#18181b'
  const onPrimary = computePrimaryForeground(primary)

  const total = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const confirmedTotal = confirmedCart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const tipAmount = (tipCents ?? 0) / 100
  const matchedZone = findMatchingZone(deliveryZipcode, deliveryZones)
  const deliveryFeeCents = orderType === 'delivery'
    ? (matchedZone != null ? matchedZone.fee_cents : (orderTypeConfig?.deliveryFeeCents ?? 0))
    : 0
  // Preview only: POST /api/orders recomputes the discount, tax and total.
  const subtotalCents = Math.round(total * 100)
  const discountCents = promo ? promoDiscountCents(subtotalCents, promo) : 0
  const taxAmountCents = salesTaxCents(subtotalCents - discountCents, taxBps)
  // Own-delivery rules; the server enforces them again. The minimum is on the items subtotal before any discount.
  const zipTyped = !!deliveryZipcode?.replace(/\D/g, '')
  const activeZoneCount = (deliveryZones ?? []).filter(z => z.is_active).length
  const ruleViolation = orderType === 'delivery' && zipTyped
    ? deliveryRuleViolation({
      rules: { ready: true, zonesOnly: deliveryZonesOnly, minByZone: matchedZone ? { [matchedZone.id]: matchedZone.min_order_cents ?? 0 } : {} },
      zonesCount: activeZoneCount, matchedZoneId: matchedZone?.id ?? null, subtotalCents,
    })
    : null
  const zipRequired = orderType === 'delivery' && deliveryZonesOnly && activeZoneCount > 0
  const grandTotal = (subtotalCents - discountCents + taxAmountCents + deliveryFeeCents + (tipCents ?? 0)) / 100

  async function applyPromo() {
    const code = promoInput.trim()
    if (!code || !tenantId || promoState === 'checking') return
    setPromoState('checking')
    try {
      const response = await fetch('/api/promo-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, code, subtotal_cents: subtotalCents }),
      })
      const data = await response.json().catch(() => null) as { valid?: boolean; code?: string; kind?: PromoKind; value?: number } | null
      if (response.ok && data?.valid && data.code && data.kind && typeof data.value === 'number') {
        onPromoChange?.({ code: data.code, kind: data.kind, value: data.value })
        setPromoInput('')
        setPromoState('idle')
      } else setPromoState('invalid')
    } catch { setPromoState('invalid') }
  }

  function handleTipPct(key: 'pct1' | 'pct2' | 'pct3', pct: number) {
    if (selectedTipKey === key) {
      setSelectedTipKey(null)
      onTipChange?.(0)
      return
    }
    setSelectedTipKey(key)
    setCustomTipValue('')
    const subtotalCents = Math.round(total * 100)
    onTipChange?.(Math.round(subtotalCents * pct / 100))
  }

  function handleCustomTip() {
    if (selectedTipKey === 'custom') {
      setSelectedTipKey(null)
      setCustomTipValue('')
      onTipChange?.(0)
      return
    }
    setSelectedTipKey('custom')
    onTipChange?.(0)
  }

  function handleCustomTipInput(value: string) {
    setCustomTipValue(value)
    // "5,50" from a comma keyboard is 5.50.
    const amount = parseFloat(value.replace(',', '.'))
    onTipChange?.(isNaN(amount) ? 0 : Math.max(0, Math.round(amount * 100)))
  }

  const activeTypes: { key: string; label: string; Icon: typeof Truck }[] = []
  if (orderTypeConfig?.dineIn) activeTypes.push({ key: 'dine_in', label: copy.dineIn, Icon: UtensilsCrossed })
  if (orderTypeConfig?.pickup) activeTypes.push({ key: 'pickup', label: copy.pickup, Icon: Package })
  if (orderTypeConfig?.delivery) activeTypes.push({ key: 'delivery', label: copy.delivery, Icon: Truck })

  const showForm = !orderSuccess && cart.length > 0
  const box = useVisibleBox()

  // Bookable slots and whether ASAP is possible, from the hours and the cart's longest notice.
  const slotInfo = useMemo(() => {
    if (!scheduling) return null
    const input = { now: new Date(), hours: scheduling.hours, timeZone: scheduling.timeZone, prepMinutes: scheduling.prepMinutes, maxNoticeMinutes: scheduling.maxNoticeMinutes }
    const slots = generateSlots(input)
    return { slots, days: groupSlotsByDay(slots, scheduling.timeZone), blocked: asapBlockedReason(input) }
  }, [scheduling])
  // ASAP not possible: start on the first slot; a slot that is no longer bookable (the cart changed) moves to the first one.
  useEffect(() => {
    if (!slotInfo || !onScheduledForChange) return
    if (scheduledFor == null) { if (slotInfo.blocked && slotInfo.slots.length) onScheduledForChange(slotInfo.slots[0]) }
    else if (!slotInfo.slots.includes(scheduledFor)) onScheduledForChange(slotInfo.slots[0] ?? null)
  }, [slotInfo, scheduledFor, onScheduledForChange])
  const mustSchedule = !!slotInfo?.blocked && scheduledFor == null
  const selectedDay = scheduling && scheduledFor != null ? localDayKey(scheduledFor, scheduling.timeZone) : null

  return (
    <BottomSheet open onClose={onClose} ariaLabel={copy.checkoutTitle} widthClassName="sm:max-w-xl" frameStyle={box.style}>
          {/* Header */}
          <div data-sheet-grip className="flex shrink-0 touch-none items-center gap-1 border-b border-zinc-100 bg-white px-2 pb-2">
            {!orderSuccess ? (
              <button type="button" onClick={onBack} className="flex size-11 items-center justify-center rounded-full text-zinc-700 transition-colors hover:bg-zinc-100" aria-label={copy.backToCart}>
                <ChevronLeft className="size-5" />
              </button>
            ) : <span className="size-11" />}
            <h2 className={`flex-1 text-center ${ui.barTitle} text-zinc-900`}>{orderSuccess ? copy.orderPlaced : copy.checkoutTitle}</h2>
            <button type="button" onClick={onClose} className="flex size-11 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900" aria-label={copy.close}>
              <X className="size-5" />
            </button>
          </div>

          {orderSuccess && orderId ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-8 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <div className="flex flex-col items-center text-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-emerald-50">
                  <Check className="size-8 text-emerald-600" strokeWidth={2.5} />
                </div>
                <p className="mt-4 text-[22px] font-semibold tracking-tight text-zinc-900">{copy.orderPlaced}</p>
                <p className="mt-1 max-w-xs text-[15px] text-zinc-600">{copy.orderThankYou}</p>
                <p className="mt-4 rounded-full bg-white px-4 py-2 font-mono text-sm font-semibold text-zinc-700 shadow-card">
                  {copy.orderNumber} #{orderId.slice(0, 8).toUpperCase()}
                </p>
                {scheduling && confirmedScheduledFor != null && (
                  <p className="mt-3 text-[15px] font-medium text-zinc-800">{copy.scheduledFor}: {formatSlotDay(confirmedScheduledFor, scheduling.timeZone, lang)}, {formatSlotTime(confirmedScheduledFor, scheduling.timeZone, lang)}</p>
                )}
                {scheduling && confirmedScheduledFor == null && scheduling.prepMinutes > 0 && (
                  <p className="mt-3 text-[15px] text-zinc-600">{fill(copy.readyIn, { min: scheduling.prepMinutes })}</p>
                )}
              </div>
              <Card className="mt-6">
                <div className="divide-y divide-zinc-100">
                  {confirmedCart.map(item => (
                    <div key={item.cartKey} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="text-[15px] text-zinc-800">{item.quantity}× {item.product.name}</span>
                      <span className="text-[15px] font-medium tabular-nums text-zinc-900">{money(item.unitPrice * item.quantity)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-[15px] font-semibold text-zinc-900">{copy.total}</span>
                    <span className="text-[17px] font-semibold tabular-nums text-zinc-900">{money(confirmedTotal)}</span>
                  </div>
                </div>
              </Card>
              <button type="button" onClick={onClose} className="mt-6 h-12 w-full rounded-2xl bg-zinc-900 text-[15px] font-semibold text-white transition-opacity hover:opacity-90">
                {copy.close}
              </button>
            </div>
          ) : (
            <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={e => { e.preventDefault(); if (!submittingOrder) onSubmit() }}>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
                {/* What you're ordering */}
                <Card>
                  <div className="divide-y divide-zinc-100">
                    {cart.map(item => {
                      const img = getProductImages(item.product)[0]
                      const optionsText = summarizeOptions(item.selectedOptions)
                      const ingredientLabels = summarizeIngredientMods(item.ingredientModifications, copy)
                      const details = [optionsText, ingredientLabels.join(' · ')].filter(Boolean).join(' · ')
                      return (
                        <div key={item.cartKey} className="flex gap-3 px-4 py-3">
                          <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                            {img
                              ? <Image src={img} alt="" width={48} height={48} className="size-full object-cover" />
                              : <div className="flex size-full items-center justify-center"><UtensilsCrossed className="size-4 text-zinc-300" /></div>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-[15px] font-medium leading-snug text-zinc-900">
                                <span className="text-zinc-500">{item.quantity}×</span> {item.product.name}
                              </p>
                              <span className="shrink-0 text-[15px] font-medium tabular-nums text-zinc-900">{money(item.unitPrice * item.quantity)}</span>
                            </div>
                            {details && <p className="mt-0.5 line-clamp-2 text-[13px] text-zinc-600">{details}</p>}
                            {item.note && <p className="mt-0.5 line-clamp-1 text-[13px] italic text-zinc-500">&ldquo;{item.note}&rdquo;</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>

                {showForm && tableName && (
                  <Card title={copy.yourTable}>
                    <div className="flex items-center gap-3 px-4 pb-4">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700"><UtensilsCrossed className="size-5" /></span>
                      <span className="min-w-0">
                        <span className="block text-[17px] font-semibold text-zinc-900">{tableName}</span>
                        <span className="block text-[14px] text-zinc-600">{copy.tableServed}</span>
                      </span>
                    </div>
                  </Card>
                )}

                {showForm && !tableName && activeTypes.length >= 2 && (
                  <Card title={copy.orderType}>
                    <div className="px-4 pb-4">
                      <div className="grid gap-1 rounded-xl bg-zinc-100 p-1" style={{ gridTemplateColumns: `repeat(${activeTypes.length}, minmax(0, 1fr))` }}>
                        {activeTypes.map(({ key, label, Icon }) => {
                          const active = orderType === key
                          return (
                            <button
                              key={key}
                              type="button"
                              aria-pressed={active}
                              onClick={() => onOrderTypeChange?.(key)}
                              className={`flex h-11 items-center justify-center gap-1.5 rounded-lg text-[14px] font-medium transition-colors ${active ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
                            >
                              <Icon className="size-4" />
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </Card>
                )}

                {showForm && scheduling && slotInfo && (slotInfo.slots.length > 0 || slotInfo.blocked) && (
                  <Card title={copy.scheduleLater}>
                    <div className="space-y-3 px-4 pb-4">
                      <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1">
                        {([false, true] as const).map(later => {
                          const active = later ? scheduledFor != null : scheduledFor == null
                          const disabled = later ? slotInfo.slots.length === 0 : !!slotInfo.blocked
                          return (
                            <button
                              key={String(later)}
                              type="button"
                              aria-pressed={active}
                              disabled={disabled}
                              onClick={() => onScheduledForChange?.(later ? (slotInfo.slots[0] ?? null) : null)}
                              className={`h-11 rounded-lg text-[14px] font-medium transition-colors disabled:opacity-40 ${active ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
                            >
                              {later ? copy.scheduleLater : copy.asap}
                            </button>
                          )
                        })}
                      </div>
                      {scheduledFor == null && !slotInfo.blocked && scheduling.prepMinutes > 0 && (
                        <p className="text-[14px] text-zinc-600">{fill(copy.readyIn, { min: scheduling.prepMinutes })}</p>
                      )}
                      {slotInfo.blocked === 'notice' && <p className="text-[14px] font-medium text-amber-800">{copy.noticeRequired}</p>}
                      {slotInfo.blocked === 'closed' && <p className="text-[14px] font-medium text-amber-800">{copy.closedScheduleOnly}</p>}
                      {slotInfo.slots.length === 0 && slotInfo.blocked && <p role="alert" className="text-[14px] font-medium text-red-700">{copy.noSlots}</p>}
                      {scheduledFor != null && selectedDay && (
                        <div className="grid grid-cols-2 gap-3">
                          <SelectField
                            label={copy.scheduleDay}
                            value={selectedDay}
                            onChange={day => onScheduledForChange?.(slotInfo.days.find(d => d.day === day)?.slots[0] ?? null)}
                            options={slotInfo.days.map(d => ({ value: d.day, label: formatSlotDay(d.slots[0], scheduling.timeZone, lang) }))}
                          />
                          <SelectField
                            label={copy.scheduleTime}
                            value={String(scheduledFor)}
                            onChange={ms => onScheduledForChange?.(Number(ms))}
                            options={(slotInfo.days.find(d => d.day === selectedDay)?.slots ?? []).map(ms => ({ value: String(ms), label: formatSlotTime(ms, scheduling.timeZone, lang) }))}
                          />
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {showForm && orderType === 'delivery' && (
                  <Card title={copy.deliveryAddress}>
                    <div className="space-y-3 px-4 pb-4">
                      <Field label={copy.street} value={deliveryStreet ?? ''} onChange={v => onDeliveryFieldChange?.('street', v)} autoComplete="address-line1" required />
                      <Field label={copy.complement} value={deliveryComplement ?? ''} onChange={v => onDeliveryFieldChange?.('complement', v)} autoComplete="address-line2" />
                      <div className="grid grid-cols-[2fr_3fr] gap-3">
                        <Field label={copy.zipcode} value={deliveryZipcode ?? ''} onChange={v => onDeliveryFieldChange?.('zipcode', v)} autoComplete="postal-code" inputMode="numeric" required={zipRequired} />
                        <Field label={copy.city} value={deliveryCity ?? ''} onChange={v => onDeliveryFieldChange?.('city', v)} autoComplete="address-level2" />
                      </div>
                      <Field label={copy.deliveryNotes} value={deliveryNotes ?? ''} onChange={v => onDeliveryFieldChange?.('notes', v)} autoComplete="off" />
                      {deliveryZones && deliveryZones.length > 0 && deliveryZipcode && (
                        matchedZone ? (
                          <p className="flex items-center gap-1.5 text-[14px] font-medium text-emerald-800">
                            <MapPin className="size-3.5" />
                            {matchedZone.name} · {money(matchedZone.fee_cents / 100)}
                          </p>
                        ) : ruleViolation?.code === 'zone_not_served' ? (
                          <p role="alert" className="text-[14px] font-medium text-red-800">{copy.noDeliveryHere}</p>
                        ) : (
                          <p className="text-[14px] font-medium text-amber-800">{copy.noDeliveryZone}</p>
                        )
                      )}
                      {ruleViolation?.code === 'minimum_not_met' && (
                        <p role="alert" className="text-[14px] font-medium text-red-800">{fill(copy.deliveryMinimum, { amount: money(ruleViolation.minOrderCents / 100) })}</p>
                      )}
                    </div>
                  </Card>
                )}

                {showForm && tipsEnabled && tipPercentages && (
                  <Card title={copy.tip}>
                    <div className="space-y-3 px-4 pb-4">
                      <div className="grid grid-cols-4 gap-2">
                        {(['pct1', 'pct2', 'pct3'] as const).map((key, i) => {
                          const pct = tipPercentages[i]
                          const active = selectedTipKey === key
                          return (
                            <button
                              key={key}
                              type="button"
                              aria-pressed={active}
                              onClick={() => handleTipPct(key, pct)}
                              className={`h-11 rounded-xl border text-[14px] font-medium tabular-nums transition-colors ${active ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'}`}
                            >
                              {pct}%
                            </button>
                          )
                        })}
                        <button
                          type="button"
                          aria-pressed={selectedTipKey === 'custom'}
                          onClick={handleCustomTip}
                          className={`h-11 rounded-xl border text-[14px] font-medium transition-colors ${selectedTipKey === 'custom' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'}`}
                        >
                          {copy.tipCustom}
                        </button>
                      </div>
                      {selectedTipKey === 'custom' && (
                        <Field label={copy.tipAmount} value={customTipValue} onChange={handleCustomTipInput} inputMode="decimal" autoComplete="off" />
                      )}
                    </div>
                  </Card>
                )}

                {showForm && promoEnabled && (
                  <Card title={copy.promoCode}>
                    <div className="space-y-2 px-4 pb-4">
                      {promo ? (
                        <div className="flex items-center justify-between text-[15px]">
                          <span className="font-semibold tabular-nums text-zinc-900">{promo.code}</span>
                          <button type="button" onClick={() => onPromoChange?.(null)} aria-label={copy.close} className="flex size-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"><X className="size-4" aria-hidden="true" /></button>
                        </div>
                      ) : (
                        <div className="flex items-end gap-2">
                          <div className="min-w-0 flex-1">
                            <Field label={copy.promoCode} value={promoInput} onChange={value => { setPromoInput(value); setPromoState('idle') }} autoComplete="off" />
                          </div>
                          <button
                            type="button"
                            onClick={applyPromo}
                            disabled={!promoInput.trim() || promoState === 'checking'}
                            className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-[14px] font-medium text-zinc-800 hover:border-zinc-300 disabled:opacity-50"
                          >
                            {copy.apply}
                          </button>
                        </div>
                      )}
                      {promoState === 'invalid' && <p role="alert" className="text-[14px] font-medium text-red-700">{copy.promoInvalid}</p>}
                    </div>
                  </Card>
                )}

                {showForm && (
                  <Card title={copy.yourDetails}>
                    <div className="space-y-3 px-4 pb-4">
                      <Field label={copy.yourName} value={customerName} onChange={onCustomerNameChange} autoComplete="name" required />
                      <div>
                        <FieldLabel htmlFor="checkout-phone" label={copy.phone} required />
                        <PhoneField
                          id="checkout-phone"
                          value={customerPhone}
                          onChange={onCustomerPhoneChange}
                          phoneContext={phoneContext}
                          locale={locale}
                          countryLabel={copy.loginCountry}
                          countrySearchLabel={copy.loginCountrySearch}
                          enterKeyHint="go"
                          required
                          onFocus={keepFieldVisible}
                          onKeyDown={nextFieldOnEnter}
                          className={FIELD_CLASS}
                        />
                      </div>
                      <Field label={copy.emailReceipt} value={contact.email} onChange={v => onContactChange?.({ email: v })} inputMode="email" autoComplete="email" />
                      {(hasPhone || hasEmail) && (
                        <div className="space-y-2">
                          {hasPhone && <OptIn label={fill(copy.optInSms, { name: restaurantName })} checked={contact.smsOptIn} onChange={v => onContactChange?.({ smsOptIn: v })} />}
                          {hasEmail && <OptIn label={fill(copy.optInEmail, { name: restaurantName })} checked={contact.emailOptIn} onChange={v => onContactChange?.({ emailOptIn: v })} />}
                          <p className="text-[13px] text-zinc-500">{copy.optInConsent}</p>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {showForm && (
                  <Card title={copy.paymentSummary}>
                    <dl className="space-y-1.5 px-4 pb-4 text-[15px]">
                      <div className="flex justify-between"><dt className="text-zinc-600">{copy.subtotal}</dt><dd className="tabular-nums text-zinc-800">{money(total)}</dd></div>
                      {discountCents > 0 && promo && (
                        <div className="flex justify-between"><dt className="text-zinc-600">{copy.discount} ({promo.code})</dt><dd className="tabular-nums text-zinc-800">-{money(discountCents / 100)}</dd></div>
                      )}
                      {taxAmountCents > 0 && (
                        <div className="flex justify-between"><dt className="text-zinc-600">{copy.tax}</dt><dd className="tabular-nums text-zinc-800">{money(taxAmountCents / 100)}</dd></div>
                      )}
                      {deliveryFeeCents > 0 && (
                        <div className="flex justify-between"><dt className="text-zinc-600">{copy.deliveryFee}</dt><dd className="tabular-nums text-zinc-800">{money(deliveryFeeCents / 100)}</dd></div>
                      )}
                      {tipAmount > 0 && (
                        <div className="flex justify-between"><dt className="text-zinc-600">{copy.tip}</dt><dd className="tabular-nums text-zinc-800">{money(tipAmount)}</dd></div>
                      )}
                      <div className="flex justify-between border-t border-zinc-100 pt-2"><dt className="font-semibold text-zinc-900">{copy.total}</dt><dd className="font-semibold tabular-nums text-zinc-900">{money(grandTotal)}</dd></div>
                    </dl>
                  </Card>
                )}
              </div>

              {showForm && (
                <div className="shrink-0 space-y-2 border-t border-zinc-100 bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  {orderError && (
                    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[14px] font-medium text-red-800">{orderError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={submittingOrder || mustSchedule || ruleViolation != null || (zipRequired && !zipTyped)}
                    style={ctaStyle(primary, onPrimary)}
                    className={`${ui.cta} h-12 w-full  disabled:opacity-60`}
                  >
                    {submittingOrder ? copy.placingOrder : (
                      <>
                        <span>{copy.placeOrder}</span>
                        <span aria-hidden="true" className="opacity-70">·</span>
                        <span className="tabular-nums">{money(grandTotal)}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>
          )}
    </BottomSheet>
  )
}

function Card({ title, className = '', children }: { title?: string; className?: string; children: ReactNode }) {
  return (
    <section className={`overflow-hidden rounded-2xl bg-white shadow-card ${className}`}>
      {title && <h3 className={`px-4 pt-4 pb-3 ${ui.label} text-zinc-500`}>{title}</h3>}
      {children}
    </section>
  )
}

const FIELD_CLASS = 'h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-[16px] text-zinc-950 outline-none transition-[border-color,box-shadow] placeholder:text-zinc-500 focus:border-zinc-900 focus:ring-[3px] focus:ring-zinc-900/10'

function FieldLabel({ htmlFor, label, required = false }: { htmlFor: string; label: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[14px] font-medium text-zinc-700">
      {label}{required && <span aria-hidden="true" className="text-zinc-500"> *</span>}
    </label>
  )
}

function OptIn({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] text-zinc-800">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="size-5 shrink-0 rounded border-zinc-300" />
      <span>{label}</span>
    </label>
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  const id = useId()
  return (
    <div>
      <FieldLabel htmlFor={id} label={label} />
      <select id={id} value={value} onChange={e => onChange(e.target.value)} className={FIELD_CLASS}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

/** A text field at 16 px (smaller makes iOS zoom in); Enter goes to the next field. */
function Field({ label, value, onChange, inputMode, autoComplete, required = false }: {
  label: string
  value: string
  onChange: (value: string) => void
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email'
  autoComplete?: string
  required?: boolean
}) {
  const id = useId()
  return (
    <div>
      <FieldLabel htmlFor={id} label={label} required={required} />
      <input
        id={id}
        type={inputMode === 'email' ? 'email' : 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        inputMode={inputMode}
        autoComplete={autoComplete}
        enterKeyHint="next"
        required={required}
        onFocus={keepFieldVisible}
        onKeyDown={nextFieldOnEnter}
        className={FIELD_CLASS}
      />
    </div>
  )
}
