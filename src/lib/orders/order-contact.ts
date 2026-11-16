/**
 * What a guest may leave besides name and phone: an email for the receipt, and
 * two optional marketing opt-ins (never pre-ticked, only for a channel they gave).
 * Pure rules shared by POST /api/orders and the contacts export.
 *
 * Schema: docs/owned-schema/20261116150000_order_contact_and_tickets.sql. Until it
 * is applied `ready` is false and orders behave as before (nothing is stored).
 */
import { MENU_LANGUAGE_CODES } from '@/components/menu/menu-i18n'

export const EMAIL_MAX = 254

/** The columns that exist only after the schema step (owned database). */
export const CONTACT_READY_SQL = `SELECT count(*) = 6 AS ready FROM information_schema.columns
  WHERE table_schema='public' AND table_name='orders' AND column_name IN (
    'customer_email','customer_language','receipt_email_sent_at','ready_email_sent_at','marketing_sms_opt_in','marketing_email_opt_in')`

/** Lower-cased address, or null when it is empty or not a plausible email. Same rule as the database CHECK. */
export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const email = input.trim().toLowerCase()
  if (!email || email.length > EMAIL_MAX) return null
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null
}

export interface OrderContactValues {
  email: string | null
  language: string | null
  smsOptIn: boolean
  emailOptIn: boolean
}

/** What to store: an opt-in counts only when the matching channel was given. */
export function resolveContact(input: {
  email?: string | null; language?: string | null; phone?: string | null
  smsOptIn?: boolean | null; emailOptIn?: boolean | null
}): OrderContactValues {
  const email = normalizeEmail(input.email)
  const language = input.language && (MENU_LANGUAGE_CODES as string[]).includes(input.language) ? input.language : null
  return {
    email,
    language,
    smsOptIn: input.smsOptIn === true && !!input.phone?.trim(),
    emailOptIn: input.emailOptIn === true && email !== null,
  }
}

/** True when there is anything worth a follow-up write. */
export function hasContactValues(v: OrderContactValues): boolean {
  return v.email !== null || v.language !== null || v.smsOptIn || v.emailOptIn
}

export interface OptedInContact {
  name: string
  phone: string | null
  email: string | null
  lastOrderAt: string
}

export type OptInOrderRow = {
  tenant_id?: string
  customer_name: string; customer_phone: string; customer_email: string | null
  marketing_sms_opt_in: boolean; marketing_email_opt_in: boolean; created_at: string
}

/**
 * Distinct opted-in contacts of one restaurant: a phone only with an SMS opt-in,
 * an email only with an email opt-in, one row per person (phone, else email),
 * newest order wins. Rows from other restaurants are dropped.
 */
export function buildOptedInContacts(rows: OptInOrderRow[], tenantId: string): OptedInContact[] {
  const byKey = new Map<string, OptedInContact>()
  for (const row of rows) {
    if (row.tenant_id !== undefined && row.tenant_id !== tenantId) continue
    const sms = row.marketing_sms_opt_in === true
    const mail = row.marketing_email_opt_in === true && !!row.customer_email
    if (!sms && !mail) continue
    const phone = sms ? row.customer_phone.trim() : null
    const email = mail ? row.customer_email : null
    const key = phone ? `p:${phone.replace(/\D/g, '')}` : `e:${email}`
    const existing = byKey.get(key)
    if (!existing) { byKey.set(key, { name: row.customer_name, phone, email, lastOrderAt: row.created_at }); continue }
    existing.phone = existing.phone ?? phone
    existing.email = existing.email ?? email
    if (Date.parse(row.created_at) > Date.parse(existing.lastOrderAt)) { existing.lastOrderAt = row.created_at; existing.name = row.customer_name }
  }
  return [...byKey.values()].sort((a, b) => Date.parse(b.lastOrderAt) - Date.parse(a.lastOrderAt))
}

/** One CSV field; formula starters are neutralised so a guest name cannot run in a spreadsheet. */
export function csvField(value: string | null): string {
  let v = value ?? ''
  if (/^[=+\-@\t\r]/.test(v) && !/^\+\d[\d\s().-]*$/.test(v)) v = `'${v}`
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function contactsCsv(contacts: OptedInContact[]): string {
  const lines = ['name,phone,email,last_order_date']
  for (const c of contacts) lines.push([c.name, c.phone, c.email, c.lastOrderAt.slice(0, 10)].map(csvField).join(','))
  return lines.join('\n') + '\n'
}
