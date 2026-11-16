import type { ReactNode } from 'react'
import TenantSiteFooter from '@/components/pages/TenantSiteFooter'
import { getTenantBySlug } from '@/lib/menu/public-menu-data'
import { loadTenantSite } from '@/lib/site/runtime'

export default async function TenantBlogLayout({ children, params }: {
  children: ReactNode; params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) return children
  const site = await loadTenantSite(slug, `/${slug}/blog`)
  if (!site) return children
  return <div className="menu-root">{children}<TenantSiteFooter tenant={tenant} settings={tenant.tenant_settings} baseUrl={site.baseUrl} /></div>
}
