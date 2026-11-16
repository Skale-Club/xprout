/**
 * Scheduled orders. A guest picks "ASAP" or a time later (up to 7 days ahead,
 * every 15 minutes, only while the restaurant is open); some dishes need notice
 * (products.min_notice_minutes). Pure rules shared by the checkout display and
 * POST /api/orders, which is the only place a time is accepted. Opening hours
 * and the time zone come from the existing helpers in chat-context.ts.
 *
 * Schema: docs/owned-schema/20261116140000_scheduled_orders.sql. Until it is
 * applied `ready` is false and every order behaves as before.
 */
import { computeOpenState, resolveTimeZone } from '@/lib/chat-context'

export const SLOT_MINUTES = 15
export const SLOT_MS = SLOT_MINUTES * 60_000
export const MAX_DAYS_AHEAD = 7
/** Matches the CHECK constraint on products.min_notice_minutes (7 days). */
export const MIN_NOTICE_MAX = 10080
/** A guest who opens checkout a moment before a slot is not rejected for it. */
export const GRACE_MS = 2 * 60_000

export type Hours = Record<string, string | null | undefined> | null | undefined

/** What the database says about scheduling for this restaurant and cart. */
export interface SchedulingState {
  /** The schema step has run (columns exist). */
  ready: boolean
  enabled: boolean
  hours: Hours
  timeZone: string | null
  /** Preparation time for an ASAP order (pickup_eta_minutes). */
  prepMinutes: number
  /** Largest min_notice_minutes among the cart's products. */
  maxNoticeMinutes: number
}

export const SCHEDULING_NOT_READY: SchedulingState = { ready: false, enabled: false, hours: null, timeZone: null, prepMinutes: 0, maxNoticeMinutes: 0 }

/** The columns that exist only after the schema step (owned database). */
export const SCHEDULING_READY_SQL = `SELECT count(*) = 3 AS ready FROM information_schema.columns
  WHERE table_schema='public' AND (
    (table_name='tenant_settings' AND column_name='scheduled_orders_enabled')
    OR (table_name='products' AND column_name='min_notice_minutes')
    OR (table_name='orders' AND column_name='scheduled_for'))`

/** Time zone of a restaurant, inferred from its profile (there is no setting). */
export function schedulingTimeZone(p: { country?: string | null; region?: string | null; currency?: string | null }): string | null {
  return resolveTimeZone(p)
}

function isOpenAt(hours: Hours, at: Date, timeZone: string): boolean {
  return computeOpenState(hours, at, timeZone).state.kind === 'open'
}

/** Notice the cart needs: the larger of the preparation time and the longest dish notice. */
export function requiredNoticeMinutes(prepMinutes: number, maxNoticeMinutes: number): number {
  return Math.max(Math.max(0, prepMinutes), Math.max(0, maxNoticeMinutes))
}

/** Why ASAP cannot be chosen, or null when it can. Unknown hours never block ASAP. */
export function asapBlockedReason(input: {
  now: Date; hours: Hours; timeZone: string | null; prepMinutes: number; maxNoticeMinutes: number
}): 'notice' | 'closed' | null {
  if (input.maxNoticeMinutes > Math.max(0, input.prepMinutes)) return 'notice'
  if (input.timeZone && computeOpenState(input.hours, input.now, input.timeZone).state.kind === 'closed') return 'closed'
  return null
}

/** The earliest time a scheduled order may ask for: now + notice, rounded up to the next slot. */
export function earliestSlotMs(now: Date, noticeMinutes: number): number {
  return Math.ceil((now.getTime() + noticeMinutes * 60_000) / SLOT_MS) * SLOT_MS
}

/** Every bookable slot (epoch ms): from the earliest to 7 days ahead, only while the restaurant is open. */
export function generateSlots(input: {
  now: Date; hours: Hours; timeZone: string | null; prepMinutes: number; maxNoticeMinutes: number
}): number[] {
  if (!input.timeZone) return []
  const end = input.now.getTime() + MAX_DAYS_AHEAD * 86_400_000
  const slots: number[] = []
  for (let t = earliestSlotMs(input.now, requiredNoticeMinutes(input.prepMinutes, input.maxNoticeMinutes)); t <= end; t += SLOT_MS) {
    if (isOpenAt(input.hours, new Date(t), input.timeZone)) slots.push(t)
  }
  return slots
}

/** Local calendar day of an instant as "YYYY-MM-DD" in the restaurant's zone. */
export function localDayKey(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms))
}

/** Slots grouped by local day, in order. */
export function groupSlotsByDay(slots: number[], timeZone: string): Array<{ day: string; slots: number[] }> {
  const groups: Array<{ day: string; slots: number[] }> = []
  for (const ms of slots) {
    const day = localDayKey(ms, timeZone)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.slots.push(ms)
    else groups.push({ day, slots: [ms] })
  }
  return groups
}

export type ScheduleRejection = { status: 400; error: string }

/**
 * The server's decision on `scheduled_for` (ISO string or absent). Returns the
 * time to store (ISO) or null for an ASAP order, or a 400 rejection.
 */
export function resolveScheduledFor(input: {
  scheduledFor: string | null | undefined
  now: Date
  state: SchedulingState
  /** Guest ordering is on (scheduling is a guest-checkout feature). */
  guestOrdering: boolean
}): { scheduledFor: string | null } | ScheduleRejection {
  const { state, now } = input
  const active = input.guestOrdering && state.ready && state.enabled
  if (!input.scheduledFor) {
    if (!active) return { scheduledFor: null }
    if (state.maxNoticeMinutes > Math.max(0, state.prepMinutes)) {
      return { status: 400, error: 'Some items need advance notice: choose a time to schedule this order' }
    }
    if (state.timeZone && computeOpenState(state.hours, now, state.timeZone).state.kind === 'closed') {
      return { status: 400, error: 'The restaurant is closed right now: choose a time to schedule this order' }
    }
    return { scheduledFor: null }
  }
  if (!active) return { status: 400, error: 'Scheduled orders are not enabled for this restaurant' }
  const ms = Date.parse(input.scheduledFor)
  if (!Number.isFinite(ms)) return { status: 400, error: 'Invalid scheduled time' }
  if (ms % SLOT_MS !== 0) return { status: 400, error: 'Scheduled time must be on a 15-minute mark' }
  const notice = requiredNoticeMinutes(state.prepMinutes, state.maxNoticeMinutes)
  if (ms < now.getTime() + notice * 60_000 - GRACE_MS) return { status: 400, error: 'Scheduled time is too soon for this order' }
  if (ms > now.getTime() + MAX_DAYS_AHEAD * 86_400_000) return { status: 400, error: 'Orders can be scheduled up to 7 days ahead' }
  if (!state.timeZone || !isOpenAt(state.hours, new Date(ms), state.timeZone)) {
    return { status: 400, error: 'The restaurant is closed at the scheduled time' }
  }
  return { scheduledFor: new Date(ms).toISOString() }
}

/** Value and unit for the dish pill ("2 h notice", "30 min notice", "1 d notice"). */
export function noticeParts(minutes: number): { unit: 'min' | 'h' | 'd'; value: number } {
  if (minutes >= 1440 && minutes % 1440 === 0) return { unit: 'd', value: minutes / 1440 }
  if (minutes >= 60) return { unit: 'h', value: Math.ceil(minutes / 60) }
  return { unit: 'min', value: minutes }
}
