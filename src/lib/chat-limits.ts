/**
 * Limits of a guest chat conversation. Client-safe (no server imports): the widget
 * and the server share the same numbers and the same small decisions.
 */

/** A conversation with no activity for this long is closed; the next message needs a new one. */
export const CHAT_IDLE_MS = 15 * 60_000

/** Per-phone message rate (on top of the per-IP limits), see the message route. */
export const CHAT_PHONE_RATE = { max: 6, window: '1 m' } as const

export const DEFAULT_MAX_MESSAGES_PER_CONVERSATION = 20
export const MIN_MAX_MESSAGES_PER_CONVERSATION = 1
export const MAX_MAX_MESSAGES_PER_CONVERSATION = 200

/** The stored cap, or the default when the column is missing, null or out of range. */
export function normalizeConversationCap(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value)
    && value >= MIN_MAX_MESSAGES_PER_CONVERSATION && value <= MAX_MAX_MESSAGES_PER_CONVERSATION
    ? value
    : DEFAULT_MAX_MESSAGES_PER_CONVERSATION
}

const toMs = (value: string | number | Date | null | undefined): number | null => {
  if (value == null) return null
  const ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

/** The latest of the last message and the start; null when neither is known. */
export function lastConversationActivityMs(startedAt: string | number | Date | null | undefined, lastMessageAt: string | number | Date | null | undefined): number | null {
  const times = [toMs(startedAt), toMs(lastMessageAt)].filter((value): value is number => value !== null)
  return times.length ? Math.max(...times) : null
}

/** True when the conversation has been quiet for CHAT_IDLE_MS or more. Unknown times never expire it. */
export function isConversationIdle(startedAt: string | number | Date | null | undefined, lastMessageAt: string | number | Date | null | undefined, now: number | Date = Date.now(), idleMs = CHAT_IDLE_MS): boolean {
  const last = lastConversationActivityMs(startedAt, lastMessageAt)
  if (last === null) return false
  return (now instanceof Date ? now.getTime() : now) - last >= idleMs
}

/** Messages are stored in user+assistant pairs, so the guest's turns are half the stored count. */
export const userMessagesFromCount = (messageCount: number | null | undefined): number =>
  Math.floor(Math.max(0, Number(messageCount) || 0) / 2)

/** True when the conversation already holds `cap` guest messages. */
export const conversationCapReached = (userMessages: number, cap: number): boolean => userMessages >= cap

/** A conversation of an earlier session can be picked up again only when it is neither idle nor full. */
export function isConversationReusable(input: { startedAt: unknown; lastMessageAt: unknown; messageCount: number | null | undefined; cap: number; now?: number | Date }): boolean {
  return !isConversationIdle(input.startedAt as string | null, input.lastMessageAt as string | null, input.now)
    && !conversationCapReached(userMessagesFromCount(input.messageCount), input.cap)
}
