import { getPublicLocale } from '@/lib/marketing/public-locale-server'
import { publicHref } from '@/lib/marketing/public-locale'
import LegalPage, { getLegalDoc, legalTitle } from '@/components/legal/LegalPage'
import { partnerLegalRoute } from '@/lib/site/legal-route'

// Matches the marketing pages: edits published from the admin panel appear
// within a minute even without the explicit revalidate on save.
export const revalidate = 60

export async function generateMetadata() {
  await partnerLegalRoute('privacy')
  const locale = await getPublicLocale()
  const doc = await getLegalDoc('privacy', locale)
  // Absolute, with the brand: the marketing layout's title has no template, as on /pricing.
  return { title: { absolute: `${legalTitle('privacy', doc, locale)} — Xprout` }, alternates: { canonical: doc?.language === locale && locale !== 'en' ? publicHref('/privacy', locale) : '/privacy' } }
}

export default async function PrivacyPage() {
  await partnerLegalRoute('privacy')
  return <LegalPage docKey="privacy" />
}
