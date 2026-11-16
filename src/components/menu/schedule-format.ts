/**
 * Wording of scheduled-order times in the restaurant's time zone and the
 * reader's language: "Tue, Nov 17", "9:00 AM", "Tue 9:00 AM".
 */
import { localeFor } from './menu-i18n'

export function formatSlotDay(ms: number, timeZone: string, lang: string): string {
  return new Intl.DateTimeFormat(localeFor(lang), { weekday: 'short', month: 'short', day: 'numeric', timeZone }).format(new Date(ms))
}

export function formatSlotTime(ms: number, timeZone: string, lang: string): string {
  return new Intl.DateTimeFormat(localeFor(lang), { hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(ms))
}

/** Short badge/confirmation form: weekday and time ("Tue 9:00 AM"). */
export function formatScheduled(ms: number, timeZone: string, lang: string): string {
  const day = new Intl.DateTimeFormat(localeFor(lang), { weekday: 'short', timeZone }).format(new Date(ms))
  return `${day} ${formatSlotTime(ms, timeZone, lang)}`
}
