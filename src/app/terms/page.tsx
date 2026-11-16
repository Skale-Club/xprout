import LegalPage, { getLegalDoc, legalTitle } from '@/components/legal/LegalPage'
import { partnerLegalRoute } from '@/lib/site/legal-route'

// Matches the marketing pages: edits published from the admin panel appear
// within a minute even without the explicit revalidate on save.
export const revalidate = 60

export async function generateMetadata() {
  await partnerLegalRoute('terms')
  // Bare title on purpose: the root layout's '%s | Xprout' template appends
  // the brand, so adding it here too would double the suffix.
  return { title: legalTitle('terms', await getLegalDoc('terms')) }
}

export default async function TermsPage() {
  await partnerLegalRoute('terms')
  return <LegalPage docKey="terms" />
}
