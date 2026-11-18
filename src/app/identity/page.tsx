import { getPublicLocale } from '@/lib/marketing/public-locale-server'
import { translatePublic } from '@/lib/marketing/public-translate'
import IdentityEntry from '@/components/auth/IdentityEntry'
import { ownedAuthSelected } from '@/lib/auth/owned-principal'

export const dynamic = 'force-dynamic'
export async function generateMetadata() { return { title: translatePublic(await getPublicLocale(), 'Phone and Google sign-in'), robots: { index: false, follow: false } } }

export default async function IdentityPage({ searchParams }: { searchParams: Promise<Record<string,string | string[] | undefined>> }) {
  const params = await searchParams
  return <IdentityEntry continueToApp={ownedAuthSelected()} existingAccountLink={params.action === 'existing-account-link'}
    linkCurrentAccount={params.action === 'link'} next={typeof params.from === 'string' ? params.from : '/'} customerFlow={params.flow === 'customer'} />
}
