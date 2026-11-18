export const PUBLIC_LOCALES = ['en', 'pt', 'es'] as const
export type PublicLocale = typeof PUBLIC_LOCALES[number]
export const PUBLIC_LOCALE_COOKIE = 'xprout_public_lang'
export const PUBLIC_LOCALE_HEADER = 'x-xprout-public-lang'

export function isPublicPlatformPath(path: string): boolean {
  return path === '/' || /^\/(?:pricing|terms|privacy|blog|3d-gallery|auth|identity|staff-access|demo|offline)(?:\/|$)/.test(path)
}

export function publicLocale(value: string | null | undefined): PublicLocale | null {
  const base = value?.toLowerCase().split('-')[0]
  return PUBLIC_LOCALES.includes(base as PublicLocale) ? base as PublicLocale : null
}

/** Explicit links override the saved preference; anonymous default HTML stays English. */
export function resolvePublicLocale(query: string | null, cookie?: string): PublicLocale {
  return publicLocale(query) ?? publicLocale(cookie) ?? 'en'
}

export function publicHref(path: string, locale: PublicLocale): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path
  const url = new URL(path, 'https://xprout.invalid')
  url.searchParams.set('lang', locale)
  return `${url.pathname}${url.search}${url.hash}`
}

export const publicIntlLocale = (locale: PublicLocale) => ({ en: 'en-US', pt: 'pt-BR', es: 'es-ES' })[locale]

export function publicAlternates(path: string, locale: PublicLocale = 'en') {
  return { canonical: locale === 'en' ? path : publicHref(path, locale), languages: { en: publicHref(path, 'en'), pt: publicHref(path, 'pt'), es: publicHref(path, 'es'), 'x-default': path } }
}
