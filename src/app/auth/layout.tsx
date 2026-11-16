import { platformLogoUrl } from '@/lib/platform-brand'
import { createServiceClient } from '@/lib/supabase/server'
import { ownedAuthSelected } from '@/lib/auth/owned-principal'
import { getOwnedShellPlatform } from '@/lib/auth/owned-shell-runtime'
import { requestSite } from '@/lib/site/request-runtime'
import { tenantMonogramIcon } from '@/lib/tenant-metadata'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const ps = ownedAuthSelected() ? await getOwnedShellPlatform() : (await createServiceClient().from('platform_settings').select('favicon_url').single()).data
  const site = await requestSite()
  const logoUrl = site.brand.id === '00000000-0000-4000-8000-000000000001' ? platformLogoUrl(ps?.favicon_url)
    : site.brand.logo || site.brand.icon || tenantMonogramIcon(site.brand.name)
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: `window.__LOGO_URL__=${JSON.stringify(logoUrl).replace(/</g, '\\u003c')}` }} />
      {children}
    </>
  )
}
