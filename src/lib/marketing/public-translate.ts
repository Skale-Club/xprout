import copy from './public-copy.json'
import shell from './public-shell-copy.json'
import type { PublicLocale } from './public-locale'

export function translatePublic(locale: PublicLocale, source: string, values?: Record<string, string | number>): string {
  const catalog = locale === 'en' ? null : copy[locale] as Record<string, string>
  const common = locale === 'en' ? null : shell[locale] as Record<string, string>
  const translated = catalog && Object.hasOwn(catalog, source) ? catalog[source]
    : common && Object.hasOwn(common, source) ? common[source] : source
  return translated.replace(/\{(\w+)\}/g, (token, key: string) => !values || !Object.hasOwn(values, key) ? token : String(values[key]))
}
