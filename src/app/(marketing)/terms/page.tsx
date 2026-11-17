import LegalPage, { getLegalDoc, legalTitle } from '@/components/legal/LegalPage'
import { partnerLegalRoute } from '@/lib/site/legal-route'

// Matches the marketing pages: edits published from the admin panel appear
// within a minute even without the explicit revalidate on save.
export const revalidate = 60

export async function generateMetadata() {
  await partnerLegalRoute('terms')
  // Absolute, with the brand: the marketing layout's title has no template, as on /pricing.
  return { title: { absolute: `${legalTitle('terms', await getLegalDoc('terms'))} — Xprout` }, alternates: { canonical: '/terms' } }
}

export default async function TermsPage() {
  await partnerLegalRoute('terms')
  return <LegalPage docKey="terms" />
}
