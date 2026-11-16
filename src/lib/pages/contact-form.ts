/**
 * The contact form of a website page: validation, the honeypot, and the email
 * to the restaurant. The email follows the order emails' rules: Resend through
 * a plain fetch, off outside production (same switches as the order emails),
 * and it never throws into the request. The submission itself is always stored
 * and listed in the admin, whether or not an email could be sent.
 */
import { escapeHtml, orderEmailMode } from '../orders/order-emails'
import { log } from '../observability/log'

export interface ContactSubmission { name: string; email: string; phone: string | null; message: string }

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/

export type ContactParse =
  | { ok: true; value: ContactSubmission }
  | { ok: true; spam: true }
  | { ok: false; error: string }

/**
 * `website` is the honeypot: hidden from people, filled by bots. A filled
 * honeypot is answered as a success and dropped, so bots learn nothing.
 */
export function parseContactSubmission(input: unknown): ContactParse {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Invalid request' }
  const body = input as Record<string, unknown>
  if (typeof body.website === 'string' && body.website.trim() !== '') return { ok: true, spam: true }
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
  const name = text(body.name), email = text(body.email).toLowerCase(), phone = text(body.phone), message = text(body.message)
  if (name.length < 1 || name.length > 120) return { ok: false, error: 'Enter your name' }
  if (email.length < 3 || email.length > 254 || !EMAIL.test(email)) return { ok: false, error: 'Enter a valid email' }
  if (phone.length > 40) return { ok: false, error: 'Phone is too long' }
  if (message.length < 1 || message.length > 3000) return { ok: false, error: 'Enter a message (up to 3000 characters)' }
  return { ok: true, value: { name, email, phone: phone || null, message } }
}

export interface ContactEmailInput {
  to: string
  restaurantName: string
  pageTitle: string
  submission: ContactSubmission
}

export interface ContactEmailDeps { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch }

/** Sends the notification; resolves true when an email went out. Never throws. */
export async function sendContactEmail(input: ContactEmailInput, deps: ContactEmailDeps = {}): Promise<boolean> {
  const env = deps.env ?? process.env
  try {
    if (!orderEmailMode(env).send) return false
    const { submission: s } = input
    const subject = `New message from ${s.name} · ${input.pageTitle}`.replace(/[\r\n]/g, ' ').slice(0, 200)
    const text = [`${s.name} <${s.email}>`, s.phone ? `Phone: ${s.phone}` : null, '', s.message].filter(v => v !== null).join('\n')
    const html = `<p><strong>${escapeHtml(s.name)}</strong> &lt;${escapeHtml(s.email)}&gt;${s.phone ? `<br>Phone: ${escapeHtml(s.phone)}` : ''}</p>`
      + `<p style="white-space:pre-wrap">${escapeHtml(s.message)}</p>`
      + `<p style="color:#71717a;font-size:12px">Sent from the contact form of "${escapeHtml(input.pageTitle)}".</p>`
    const response = await (deps.fetchImpl ?? fetch)('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${input.restaurantName.replace(/[<>"\r\n]/g, '').trim() || 'Website'} <${env.ORDER_EMAIL_FROM}>`,
        to: [input.to], reply_to: s.email, subject, html, text,
      }),
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error(`Resend answered ${response.status}`)
    return true
  } catch (err) {
    log.error('pages.contact_email_error', { err })
    return false
  }
}
