import { getEffectiveTenant } from '@/lib/get-effective-tenant'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { withApi } from '@/lib/observability/with-api'
import { log } from '@/lib/observability/log'
import { adminMenusOwned, AdminMenuError } from '@/lib/data/admin-menus'
import { mutateOwnedDisplaySettings } from '@/lib/data/admin-display-settings-runtime'
import { hasSameOriginAdminMutation } from '@/lib/data/admin-display-settings'
import { parseLocalSeoUpdate } from '@/lib/seo'

/**
 * PATCH /api/admin/seo
 * SEED-014: server-side save for per-tenant SEO overrides. Caps text fields,
 * validates the optional OG image URL (https), coerces the noindex flag, and
 * scopes the write to the caller's own tenant. Empty strings persist as NULL so
 * the public pages fall back to derived values.
 */
async function handlePATCH(request: Request) {
  const effective = await getEffectiveTenant()
  if (!effective) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (effective.role === 'store-staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!hasSameOriginAdminMutation(request)) return NextResponse.json({ error: 'Origin mismatch' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  const local = parseLocalSeoUpdate(body)
  if (!local.ok) return NextResponse.json({ error: local.error }, { status: 400 })

  const str = (v: unknown, max: number): string | null => {
    if (typeof v !== 'string') return null
    const t = v.trim().slice(0, max)
    return t ? t : null
  }

  // Optional OG image override must be an https URL (from our upload endpoint) or null.
  let ogImage: string | null = null
  const rawOg = body.seo_og_image_url
  if (rawOg !== null && rawOg !== undefined && rawOg !== '') {
    if (typeof rawOg !== 'string' || !/^https:\/\//.test(rawOg.trim())) {
      return NextResponse.json({ error: 'Invalid seo_og_image_url' }, { status: 400 })
    }
    ogImage = rawOg.trim().slice(0, 2048)
  }

  const update: Record<string, unknown> = {
    tenant_id: effective.tenantId,
    ...('seo_title' in body ? { seo_title: str(body.seo_title, 70) } : {}),
    ...('seo_description' in body ? { seo_description: str(body.seo_description, 200) } : {}),
    ...('seo_keywords' in body ? { seo_keywords: str(body.seo_keywords, 300) } : {}),
    ...('seo_og_image_url' in body ? { seo_og_image_url: ogImage } : {}),
    ...('seo_noindex' in body ? { seo_noindex: body.seo_noindex === true } : {}),
    ...local.value,
  }
  if (Object.keys(update).length === 1) return NextResponse.json({ error: 'No SEO settings supplied' }, { status: 400 })

  if (adminMenusOwned()) {
    try {
      const values = Object.fromEntries(Object.entries(update).filter(([key]) => key !== 'tenant_id'))
      await mutateOwnedDisplaySettings({ tenantId: effective.tenantId, role: effective.role }, 'seo', values)
      return NextResponse.json({ ok: true })
    } catch (error) {
      if (error instanceof AdminMenuError) return NextResponse.json({ error: error.message }, { status: error.status })
      log.error('PATCH /api/admin/seo', { err: error })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  const service = await createServiceClient()
  const { error } = await service
    .from('tenant_settings')
    .upsert(update, { onConflict: 'tenant_id' })

  if (error) {
    if (Object.keys(local.value).length && ['42703', 'PGRST204'].includes(error.code)) return NextResponse.json({ error: 'Local SEO settings are not available yet' }, { status: 503 })
    log.error('PATCH /api/admin/seo', { err: error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export const PATCH = withApi('PATCH /api/admin/seo', handlePATCH)
