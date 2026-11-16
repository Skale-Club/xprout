'use client'

import { useState, type FormEvent } from 'react'
import { ctaStyle, ui } from '@/components/menu/menu-ui'

export interface ContactFormCopy {
  name: string; email: string; phone: string; message: string; send: string; sending: string; sent: string; error: string
}

/**
 * The contact form of a website page. Fixed fields (name, email, optional
 * phone, message) and a honeypot ("website") that people never see.
 */
export default function PageContactForm({ tenantSlug, pageSlug, copy, primaryColor, primaryForeground }: {
  tenantSlug: string
  pageSlug: string
  copy: ContactFormCopy
  primaryColor: string
  primaryForeground: string
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorText, setErrorText] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setState('sending')
    setErrorText(null)
    try {
      const response = await fetch('/api/pages/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: tenantSlug, page: pageSlug,
          name: form.get('name'), email: form.get('email'), phone: form.get('phone'), message: form.get('message'), website: form.get('website'),
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        setErrorText(response.status === 400 && body?.error ? body.error : copy.error)
        setState('error')
        return
      }
      setState('sent')
    } catch {
      setErrorText(copy.error)
      setState('error')
    }
  }

  if (state === 'sent') {
    return <p role="status" className="rounded-2xl bg-white p-5 text-[15px] font-medium text-zinc-900 shadow-card">{copy.sent}</p>
  }

  const field = 'mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-[16px] text-zinc-900 outline-none focus:border-zinc-900'
  const label = 'block text-[13px] font-medium text-zinc-600'
  return (
    <form onSubmit={submit} className="grid gap-4 rounded-2xl bg-white p-5 shadow-card">
      <label className={label}>{copy.name}
        <input name="name" required maxLength={120} autoComplete="name" className={field} />
      </label>
      <label className={label}>{copy.email}
        <input name="email" type="email" required maxLength={254} autoComplete="email" className={field} />
      </label>
      <label className={label}>{copy.phone}
        <input name="phone" type="tel" maxLength={40} autoComplete="tel" className={field} />
      </label>
      <label className={label}>{copy.message}
        <textarea name="message" required maxLength={3000} rows={5} className={field} />
      </label>
      {/* Honeypot: off screen and out of the tab order; only bots fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      {state === 'error' && errorText && <p role="alert" className="text-[14px] font-medium text-red-600">{errorText}</p>}
      <button type="submit" disabled={state === 'sending'} className={`${ui.cta} h-12 disabled:opacity-60`} style={ctaStyle(primaryColor, primaryForeground)}>
        {state === 'sending' ? copy.sending : copy.send}
      </button>
    </form>
  )
}
