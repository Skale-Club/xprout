import { ownedAuthSelected } from '@/lib/auth/owned-principal'
import IdentityEntry from '@/components/auth/IdentityEntry'
import LegacyLogin from './LegacyLogin'
import { guestBrandFor } from '@/lib/auth/guest-brand'
import { requestSite } from '@/lib/site/request-runtime'
import { identityRuntimeConfig } from '@/lib/auth/identity-runtime-config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string,string | string[] | undefined>> }) {
  if (!ownedAuthSelected()) return <LegacyLogin />
  const params = await searchParams
  const site = await requestSite()
  if (site.brand.id !== '00000000-0000-4000-8000-000000000001') {
    let origin: string | undefined
    try { origin = identityRuntimeConfig().origin } catch { /* IdentityEntry presents the configured recovery state. */ }
    if (origin && (await headers()).get('host')?.toLowerCase() !== new URL(origin).host.toLowerCase()) {
      const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
      query.set('brand', site.brand.id)
      redirect(`${origin}/auth/login?${query}`)
    }
  }
  // embed=1: shown inside a popup (the menu's guest sign-in, or the marketing site's sign-in).
  const embedded = params.embed === '1'
  // Inside a restaurant's menu: its banner, logo, colour, country and language (public menu facts only).
  const brand = embedded && params.flow === 'customer' ? await guestBrandFor(params.tenant, params.lang) : null
  return <IdentityEntry continueToApp existingAccountLink={params.action === 'existing-account-link'}
    next={typeof params.from === 'string' ? params.from : '/'} customerFlow={params.flow === 'customer'}
    embedded={embedded} brand={brand} />
}
