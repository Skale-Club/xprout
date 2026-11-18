import { getPublicLocale } from '@/lib/marketing/public-locale-server'
import { publicHref } from '@/lib/marketing/public-locale'
import LegalPage, { getLegalDoc, legalTitle } from '@/components/legal/LegalPage'
import { partnerLegalRoute } from '@/lib/site/legal-route'

// Matches the marketing pages: edits published from the admin panel appear
// within a minute even without the explicit revalidate on save.
export const revalidate = 60

export async function generateMetadata() {
  await partnerLegalRoute('terms')
  const locale = await getPublicLocale()
  const doc = await getLegalDoc('terms', locale)
  // Absolute, with the brand: the marketing layout's title has no template, as on /pricing.
  return { title: { absolute: `${legalTitle('terms', doc, locale)} — Xprout` }, alternates: { canonical: doc?.language === locale && locale !== 'en' ? publicHref('/terms', locale) : '/terms' } }
}

export default async function TermsPage() {
  await partnerLegalRoute('terms')
  return <LegalPage docKey="terms" />
}
