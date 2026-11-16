import type { Metadata } from 'next'
import { getTenantBySlug } from '@/lib/menu/public-menu-data'
import { tenantMetadata } from '@/lib/tenant-metadata'
import { tenantSiteMetadata } from '@/lib/site/runtime'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const [tenant, siteMetadata] = await Promise.all([
    getTenantBySlug(slug),
    tenantSiteMetadata(slug, `/${slug}`),
  ])
  return { ...(tenant ? tenantMetadata(tenant.name, tenant.tenant_settings?.logo_url, slug) : {}), ...siteMetadata }
}

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return children
}
