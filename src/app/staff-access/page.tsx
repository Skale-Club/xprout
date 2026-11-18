import { getPublicLocale } from '@/lib/marketing/public-locale-server'
import { translatePublic } from '@/lib/marketing/public-translate'
import { publicHref } from '@/lib/marketing/public-locale'
import { notFound } from 'next/navigation'
import IdentityEntry from '@/components/auth/IdentityEntry'
import { ownedAuthSelected } from '@/lib/auth/owned-principal'
import { getOwnedPrincipal } from '@/lib/auth/owned-principal-runtime'
import { accountAdministrationSelected } from '@/lib/data/account-administration'

export const dynamic = 'force-dynamic'
export async function generateMetadata() { return { title: translatePublic(await getPublicLocale(), 'Staff access'), robots: { index: false, follow: false }, referrer: 'no-referrer' as const } }
export default async function StaffAccessPage({ searchParams }: {searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const locale = await getPublicLocale()
  const t = (source: string) => translatePublic(locale, source)
  if (!ownedAuthSelected() || !accountAdministrationSelected()) notFound()
  const params = await searchParams,raw = params.invite ?? params.recovery
  if (raw !== undefined && (typeof raw !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(raw))) notFound()
  if (params.invite && params.recovery) notFound()
  const principal = await getOwnedPrincipal()
  return <main className="mx-auto max-w-xl space-y-6 px-6 py-12">
    <h1 className="text-2xl font-bold">{params.recovery ? t("Restore your staff access") : raw ? t("Accept staff invitation") : t("Your verified account")}</h1>
    {principal && <section className="rounded-xl border p-5"><p>{t("Share this account ID with your store administrator.")}</p><code className="mt-3 block break-all select-all">{principal.userId}</code></section>}
    <p>{params.recovery ? t("Your earlier local sessions were revoked. Verify the phone or Google sign-in method already linked to this account to complete this exact reset. If you lost every sign-in method, request independent reviewed recovery.") : raw ? t("Verify the phone or Google sign-in method already linked to the exact invited account. The invitation grants access only to its original store.") : t("Register and verify your own account before requesting an invitation. Administrators cannot create a password or claim ownership through an email address.")}</p>
    {raw ? <IdentityEntry continueToApp staffAccess={{kind:params.recovery ? 'recovery' : 'invite',code:raw}} /> : <nav className="flex gap-5"><a href={publicHref("/auth/register?from=%2Fstaff-access", locale)} className="underline">{t("Register your own account")}</a><a href={publicHref("/identity?from=%2Fstaff-access&flow=customer", locale)} className="underline">{t('Sign in')}</a></nav>}
    {raw&&<p><a className="underline" href={publicHref("/identity?from=%2Fdashboard", locale)}>{t("Already completed this access link? Sign in to your account.")}</a></p>}
  </main>
}
