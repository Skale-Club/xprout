'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { PUBLIC_LOCALES, PUBLIC_LOCALE_COOKIE, publicHref, type PublicLocale } from '@/lib/marketing/public-locale'
import { translatePublic } from '@/lib/marketing/public-translate'

const LocaleContext = createContext<PublicLocale>('en')

export function PublicLocaleProvider({ locale, children }: { locale: PublicLocale; children?: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

export function usePublicLocale() {
  const locale = useContext(LocaleContext)
  return useMemo(() => ({ locale, t: (source: string, values?: Record<string, string | number>) => translatePublic(locale, source, values), href: (path: string) => publicHref(path, locale) }), [locale])
}

export function PublicLanguagePicker() {
  const { locale, t } = usePublicLocale()
  return <label className="inline-flex items-center gap-2 text-sm">
    <span className="sr-only">{t('Language')}</span>
    <select aria-label={t('Language')} value={locale} className="max-w-28 rounded-md border border-current/30 bg-transparent px-2 py-2 text-inherit" onChange={event => {
      const selected = event.target.value as PublicLocale
      document.cookie = `${PUBLIC_LOCALE_COOKIE}=${selected}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
      location.assign(publicHref(`${location.pathname}${location.search}${location.hash}`, selected))
    }}>
      {PUBLIC_LOCALES.map(value => <option className="bg-white text-zinc-900" key={value} value={value} lang={value}>{({ en: 'English', pt: 'Português', es: 'Español' })[value]}</option>)}
    </select>
  </label>
}
