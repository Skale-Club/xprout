import { NextResponse } from 'next/server'
import { getEffectiveTenant } from '@/lib/get-effective-tenant'
import { getTenantCapabilities } from '@/lib/tenant-plan'
import { hasSameOriginAdminMutation } from '@/lib/data/admin-display-settings'
import { AdminMenuError } from '@/lib/data/admin-menus'
import { tenantPagesAvailable } from '@/lib/data/tenant-pages-runtime'
import { log } from '@/lib/observability/log'

export const pagesJson = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

export function pagesFailure(error: unknown) {
  if (error instanceof AdminMenuError && error.status < 500) return pagesJson({ error: error.message }, error.status)
  if (error instanceof SyntaxError) return pagesJson({ error: 'Invalid request body' }, 400)
  log.error('admin.pages_error', { err: error })
  return pagesJson({ error: 'Website pages are unavailable' }, 503)
}

/**
 * Website pages are an owner setting and ride the plan capability that enables
 * the restaurant blog (plan.blog): staff are refused, and so is a plan without it.
 */
export async function authorizePages(request: Request, write: boolean) {
  if (write && !hasSameOriginAdminMutation(request)) return { response: pagesJson({ error: 'Origin mismatch' }, 403) }
  const effective = await getEffectiveTenant()
  if (!effective) return { response: pagesJson({ error: 'Unauthorized' }, 401) }
  if (effective.role === 'store-staff') return { response: pagesJson({ error: 'Forbidden' }, 403) }
  if (!(await getTenantCapabilities(effective.tenantId)).plan.blog) return { response: pagesJson({ error: 'Website pages are not part of your plan' }, 403) }
  if (!tenantPagesAvailable()) return { response: pagesJson({ error: 'Website pages are available after the next update' }, 503) }
  return { context: { tenantId: effective.tenantId, role: effective.role }, slug: effective.slug }
}
