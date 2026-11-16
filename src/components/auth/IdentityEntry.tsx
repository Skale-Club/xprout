import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { identityRuntimeConfig } from '@/lib/auth/identity-runtime-config'
import { verifyPublicProject } from '@/lib/auth/public-project-proof'
import IdentityPilot from '@/app/identity/IdentityPilot'
import type { GuestBrand } from '@/lib/auth/guest-brand'
import { requestSite } from '@/lib/site/request-runtime'

export default async function IdentityEntry(props: { continueToApp?: boolean; existingAccountLink?: boolean; next?: string; customerFlow?: boolean; linkCurrentAccount?: boolean; staffAccess?: { kind:'invite'|'recovery';code:string }; embedded?: boolean; brand?: GuestBrand | null }) {
  if (process.env.GOOGLE_AUTH_ENABLED !== 'true') notFound()
  let config: ReturnType<typeof identityRuntimeConfig>
  try { config = identityRuntimeConfig() }
  catch { return <main className="platform-dark grid min-h-screen place-items-center bg-zinc-950 px-6 text-platform-ivory"><p>Sign-in is temporarily unavailable. Please try again later.</p></main> }
  if ((await headers()).get('host')?.toLowerCase() !== new URL(config.origin).host.toLowerCase()) notFound()
  try { await verifyPublicProject({ ...config.web, projectNumber: config.projectNumber, origin: config.origin }) }
  catch { return <main className="platform-dark grid min-h-screen place-items-center bg-zinc-950 px-6 text-platform-ivory"><p>Sign-in is temporarily unavailable. Please try again later.</p></main> }
  const site = await requestSite()
  const platformBrand = site.brand.id !== '00000000-0000-4000-8000-000000000001'
    ? { name: site.brand.name, logoUrl: site.brand.logo ?? site.brand.icon ?? null, termsUrl: site.brand.terms_url, privacyUrl: site.brand.privacy_url } : undefined
  return <IdentityPilot key={props.existingAccountLink ? 'existing' : props.linkCurrentAccount ? 'link' : 'login'} config={config.web} {...props} platformBrand={platformBrand} />
}
