'use client'

import { usePublicLocale, PublicLanguagePicker } from '@/components/marketing/PublicLocale'

import { useEffect, useRef, useState } from 'react'
import { googleProof, phoneProof, type IdentityWebConfig } from '@/lib/auth/identity-browser'
import { requireLoginAuthority } from '@/lib/auth/browser-login-authority'
import { ownedLoginDestination } from '@/lib/auth/browser-owned-login'
import Link from 'next/link'
import { keepFieldVisible, nextFieldOnEnter } from '@/components/ui/keyboard-fields'

export default function NativeRegister({ config, customer, next }: { config: IdentityWebConfig; customer: boolean; next: string }) {
  const { t, href } = usePublicLocale()
  const [name,setName] = useState(''), [phone,setPhone] = useState(''), [code,setCode] = useState('')
  const [busy,setBusy] = useState(false), [sent,setSent] = useState(false), [error,setError] = useState('')
  const pending = useRef(false), container = useRef<HTMLDivElement>(null)
  const attempt = useRef<Awaited<ReturnType<typeof phoneProof>> | null>(null)
  useEffect(() => () => attempt.current?.cancel(), [])
  async function post(operation: string, body: object) {
    const response = await fetch(`/api/identity/${operation}`, { method: 'POST',credentials: 'same-origin',cache: 'no-store',redirect: 'error',
      headers: { 'Content-Type': 'application/json' },body: JSON.stringify(body) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Registration is temporarily unavailable.')
    return data
  }
  async function run(action: () => Promise<void>) {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      await requireLoginAuthority('owned')
      if (!name.trim()) throw new Error('Enter your full name first.')
      await action()
    } catch (error) { setError(error instanceof Error ? error.message : t("Verification failed. Try again.")) }
    finally { pending.current = false; setBusy(false) }
  }
  async function complete(idToken: string) {
    const { challenge } = await post('challenge',{})
    await post(customer ? 'register-customer' : 'register-business',{ idToken,challenge,name })
    window.location.assign(await ownedLoginDestination(customer ? next : '/onboarding',fetch,customer))
  }
  const field = 'w-full rounded-xl border border-white/15 bg-zinc-950 px-4 py-3 text-platform-ivory disabled:opacity-50'
  const button = 'w-full rounded-full bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-50'
  return <main className="platform-dark grid min-h-screen place-items-center bg-zinc-950 px-5 py-10 text-platform-ivory">
    <div className="fixed right-4 top-4"><PublicLanguagePicker /></div>
    <section aria-labelledby="register-title" className="w-full max-w-sm space-y-5 rounded-3xl border border-white/10 bg-zinc-900/60 p-6 sm:p-8">
      <Link href={href("/")} className="font-black">Xprout</Link>
      <h1 id="register-title" className="text-2xl font-bold">{customer ? t("Create your customer account") : t("Create your business account")}</h1>
      <p className="text-sm leading-6 text-zinc-400">{t("Verify your phone by SMS, or use Google to create a new account.")}</p>
      {error ? <p role="alert" className="text-sm text-red-300">{t(error)}</p> : null}
      {/* Name, phone and code in one form: the keyboard's Next goes from the name to the phone, Go sends. */}
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); void run(async () => {
        if (sent) {
          const verification = attempt.current
          if (!verification) throw new Error('Request a new verification code.')
          attempt.current = null; setSent(false)
          await complete(await verification.confirm(code))
        } else {
          if (!container.current) throw new Error('Reload and try again.')
          attempt.current = await phoneProof(config,phone); setSent(true)
        }
      }) }}>
        <label htmlFor="register-name" className="block text-sm font-semibold">{t("Full name")}</label>
        <input id="register-name" autoComplete="name" autoCapitalize="words" enterKeyHint="next" maxLength={120} required value={name}
          onChange={event => setName(event.target.value)} onFocus={keepFieldVisible} onKeyDown={nextFieldOnEnter} disabled={busy || sent} className={field} />
        <label htmlFor="register-phone" className="block text-sm font-semibold">{t("Phone with country code")}</label>
        <input id="register-phone" type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="send" placeholder="+10000000000" value={phone}
          onChange={event => setPhone(event.target.value)} onFocus={keepFieldVisible} disabled={busy || sent} required className={field} />
        <div ref={container} />
        {sent ? <><label htmlFor="register-code" className="block text-sm font-semibold">{t("SMS verification code")}</label>
          {/* Focused as it appears: sending disabled the phone field and closed the keyboard. */}
          <input id="register-code" autoComplete="one-time-code" inputMode="numeric" enterKeyHint="done" pattern="[0-9]{6}" maxLength={6} autoFocus value={code}
            onChange={event => setCode(event.target.value.replace(/\D/g, ''))} onFocus={keepFieldVisible} disabled={busy} required className={field} /></> : null}
        <button disabled={busy} className={button}>{busy ? t("Verifying…") : sent ? t("Verify and create account") : t("Send verification code")}</button>
        {sent ? <button type="button" disabled={busy} onClick={() => { attempt.current?.cancel(); attempt.current = null; setSent(false); setCode('') }} className="min-h-11 w-full text-sm underline">{t("Use another number")}</button> : null}
      </form>
      <button type="button" disabled={busy || sent} onClick={() => void run(async () => complete(await googleProof(config)))} className={button}>{t("Create account with Google")}</button>
      <p className="text-sm text-zinc-400">{t("Already have an account?")} <Link className="text-platform-ivory underline" href={href(`/auth/login?from=${encodeURIComponent(next)}${customer ? '&flow=customer' : ''}`)}>{t("Sign in")}</Link> {t("or")} <Link className="text-platform-ivory underline" href={href("/auth/login?action=existing-account-link")}>{t("link your existing account")}</Link>.</p>
    </section>
  </main>
}
