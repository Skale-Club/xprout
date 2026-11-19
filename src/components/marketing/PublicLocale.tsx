'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { PUBLIC_LOCALES, PUBLIC_LOCALE_COOKIE, publicHref, type PublicLocale } from '@/lib/marketing/public-locale'
import { translatePublic } from '@/lib/marketing/public-translate'
import LanguagePicker from '@/components/menu/LanguagePicker'

const LocaleContext = createContext<PublicLocale>('en')

export function PublicLocaleProvider({ locale, children }: { locale: PublicLocale; children?: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

export function usePublicLocale() {
  const locale = useContext(LocaleContext)
  return useMemo(() => ({ locale, t: (source: string, values?: Record<string, string | number>) => translatePublic(locale, source, values), href: (path: string) => publicHref(path, locale) }), [locale])
}

export function PublicLanguagePicker({ align = 'right' }: { align?: 'left' | 'right' } = {}) {
  const { locale, t } = usePublicLocale()
  return <LanguagePicker languages={[...PUBLIC_LOCALES]} value={locale} label={t('Language')} compact align={align} onChange={value => {
      const selected = value as PublicLocale
      document.cookie = `${PUBLIC_LOCALE_COOKIE}=${selected}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
      location.assign(publicHref(`${location.pathname}${location.search}${location.hash}`, selected))
    }} />
}
