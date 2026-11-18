import { headers } from 'next/headers'
import { publicLocale, PUBLIC_LOCALE_HEADER } from './public-locale'

export async function getPublicLocale() {
  return publicLocale((await headers()).get(PUBLIC_LOCALE_HEADER)) ?? 'en'
}
