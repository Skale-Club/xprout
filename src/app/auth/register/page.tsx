import { getPublicLocale } from '@/lib/marketing/public-locale-server'
import { translatePublic } from '@/lib/marketing/public-translate'
import { headers } from 'next/headers'
import { ownedAuthSelected } from '@/lib/auth/owned-principal'
import { identityRuntimeConfig } from '@/lib/auth/identity-runtime-config'
import { verifyPublicProject } from '@/lib/auth/public-project-proof'
import LegacyRegister from './LegacyRegister'
import NativeRegister from './NativeRegister'

export const dynamic = 'force-dynamic'
export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string,string | string[] | undefined>> }) {
  const locale = await getPublicLocale()
  const t = (source: string) => translatePublic(locale, source)
  if (!ownedAuthSelected()) return <LegacyRegister />
  if (process.env.OWNED_REGISTRATION_ENABLED !== 'true' || process.env.GOOGLE_AUTH_ENABLED !== 'true') {
    return <main className="p-8">{t('Registration is temporarily unavailable. Please try again later.')}</main>
  }
  let config: ReturnType<typeof identityRuntimeConfig>
  try {
    config = identityRuntimeConfig()
    if ((await headers()).get('host')?.toLowerCase() !== new URL(config.origin).host.toLowerCase()) throw new Error('Origin mismatch')
    await verifyPublicProject({ ...config.web,projectNumber: config.projectNumber,origin: config.origin })
  } catch {
    return <main className="p-8">{t('Registration is temporarily unavailable. Please try again later.')}</main>
  }
  const params = await searchParams
  const from = typeof params.from === 'string' && params.from.startsWith('/') && !params.from.startsWith('//') && !params.from.includes('\\') ? params.from : '/'
  const customer = from !== '/' && !from.startsWith('/auth') && !['/dashboard','/onboarding'].includes(from)
  return <NativeRegister config={config.web} customer={customer} next={from} />
}
