import { NextResponse } from 'next/server'
import { getTenantBySlug } from '@/lib/menu/public-menu-data'
import { buildTenantManifest } from '@/lib/tenant-manifest'

// The tenant read is cached 60 s per slug; the response is shared the same way.
const CACHE_CONTROL = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300'

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const manifest = buildTenantManifest({
    slug: tenant.slug ?? slug,
    name: tenant.name,
    logoUrl: tenant.tenant_settings?.logo_url,
    primaryColor: tenant.tenant_settings?.primary_color,
    customDomain: tenant.custom_domain,
    customDomainVerified: tenant.custom_domain_verified,
  }, request.headers.get('host'))
  return new NextResponse(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': CACHE_CONTROL, Vary: 'Host' },
  })
}
