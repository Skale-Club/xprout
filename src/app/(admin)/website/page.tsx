export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getEffectiveTenant } from '@/lib/get-effective-tenant'
import { getTenantCapabilities } from '@/lib/tenant-plan'
import { tenantPagesAvailable } from '@/lib/data/tenant-pages-runtime'
import WebsiteClient from './WebsiteClient'

/**
 * Website pages: an owner setting that rides the plan capability that enables
 * the restaurant blog (plan.blog). Staff and plans without it go back to the dashboard.
 */
export default async function WebsitePage() {
  const effective = await getEffectiveTenant()
  if (!effective) redirect('/auth/login')
  if (effective.role === 'store-staff') redirect('/dashboard')
  if (!(await getTenantCapabilities(effective.tenantId)).plan.blog) redirect('/dashboard')
  return <WebsiteClient tenantSlug={effective.slug} tenantName={effective.name} available={tenantPagesAvailable()} />
}
