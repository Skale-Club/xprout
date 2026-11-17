import LegalPage, { getLegalDoc, legalTitle } from '@/components/legal/LegalPage'
import { partnerLegalRoute } from '@/lib/site/legal-route'

// Matches the marketing pages: edits published from the admin panel appear
// within a minute even without the explicit revalidate on save.
export const revalidate = 60

export async function generateMetadata() {
  await partnerLegalRoute('privacy')
  // Absolute, with the brand: the marketing layout's title has no template, as on /pricing.
  return { title: { absolute: `${legalTitle('privacy', await getLegalDoc('privacy'))} — Xprout` }, alternates: { canonical: '/privacy' } }
}

export default async function PrivacyPage() {
  await partnerLegalRoute('privacy')
  return <LegalPage docKey="privacy" />
}
