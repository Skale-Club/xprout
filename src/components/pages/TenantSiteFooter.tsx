import TenantPublicFooter, { type FooterSettings, type FooterLink } from './TenantPublicFooter'
import { loadLocalNavigation } from '@/lib/menu/local-navigation'
import { loadPublicPages } from '@/lib/data/tenant-pages-runtime'

export default async function TenantSiteFooter({ tenant, settings, baseUrl, nav, links = [] }: {
  tenant: { id: string; slug: string; name: string }
  settings: FooterSettings | null
  baseUrl: string
  nav?: readonly { slug: string; title: string }[]
  links?: readonly FooterLink[]
}) {
  const base = baseUrl.replace(/\/$/, '')
  const [local, pages] = await Promise.all([
    loadLocalNavigation(tenant.id, base),
    nav === undefined ? loadPublicPages(tenant, null).then(bundle => bundle.nav) : Promise.resolve(nav),
  ])
  const pageLinks = pages.filter(page => /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(page.slug)).slice(0, 100)
    .map(page => ({ title: page.title, href: `${base}/${page.slug}` }))
  return <TenantPublicFooter name={tenant.name} settings={settings} links={[
    { title: tenant.name, href: base || '/' }, ...links, ...local, ...pageLinks,
  ]} />
}
