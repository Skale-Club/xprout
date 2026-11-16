import type { AdminMenuQuery } from './admin-menus'
import { parseTags, tagSlug } from '../blog/public-queries'
import type { SiteBrand, SiteTenant } from '../site/resolve-site'
import { pickDefaultMenu, pickSectionMenu } from '../menu/public-menu-model'

const iso = (value: unknown): string | null => {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null
  return typeof value === 'string' ? value : null
}
const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/i

export interface SeoTenant extends SiteTenant { id: string; updated_at: string | null }
// tenants.subdomain through to_jsonb(t): null until the schema step adds it.
const SUBDOMAIN = `to_jsonb(t)->>'subdomain' AS subdomain`
const label = (value: unknown) => (typeof value === 'string' && value ? value : null)

// JSON access tolerates code-first deployment. Once published_at exists, NULL is
// a deliberate draft and must never fall back to created_at.
const SITE_COLUMNS = `t.id, t.name, t.is_active,
  COALESCE((to_jsonb(t)->>'is_demo')::boolean, false) AS is_demo,
  CASE WHEN to_jsonb(t) ? 'published_at' THEN to_jsonb(t)->>'published_at' ELSE to_jsonb(t)->>'created_at' END AS published_at,
  to_jsonb(t)->>'brand_id' AS brand_id, s.language, s.seo_noindex`

function seoTenant(row: Record<string, unknown>): SeoTenant {
  return { id: String(row.id), slug: String(row.slug), name: String(row.name),
    is_active: row.is_active === true, is_demo: row.is_demo === true,
    published_at: iso(row.published_at), brand_id: label(row.brand_id),
    custom_domain: label(row.custom_domain), custom_domain_verified: row.custom_domain_verified === true,
    subdomain: label(row.subdomain), updated_at: iso(row.updated_at),
    tenant_settings: { language: label(row.language), seo_noindex: row.seo_noindex === true } }
}

export async function readSitemapTenants(query: AdminMenuQuery) {
  const { rows } = await query(`SELECT t.slug, t.updated_at, t.custom_domain, t.custom_domain_verified, ${SUBDOMAIN}, ${SITE_COLUMNS}
    FROM public.tenants t LEFT JOIN public.tenant_settings s ON s.tenant_id=t.id
    WHERE t.is_active=true ORDER BY t.updated_at DESC LIMIT 5000`)
  return rows.map(seoTenant)
}

/** Platform blog (tenant_id IS NULL) only; posts, tags and archive come from one bounded read. */
export async function readPlatformBlogSitemap(query: AdminMenuQuery, now = new Date()) {
  const { rows } = await query(`SELECT slug, tags, published_at, updated_at FROM public.blog_posts
    WHERE tenant_id IS NULL AND status='published' ORDER BY published_at DESC NULLS LAST LIMIT 5000`)
  const posts = rows.slice(0, 1000).map(row => ({ slug: String(row.slug), published_at: iso(row.published_at), updated_at: iso(row.updated_at) }))
  const live = rows.filter(row => row.published_at instanceof Date && row.published_at.getTime() <= now.getTime())
  const tags = new Set<string>(), archive = new Map<string, { year: number; month: number }>()
  for (const row of live) {
    for (const tag of parseTags(row.tags as string | null)) { const slug = tagSlug(tag); if (slug) tags.add(slug) }
    const date = row.published_at as Date
    archive.set(`${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`, { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 })
  }
  return { posts, tags: [...tags], archive: [...archive.values()].sort((a, b) => b.year - a.year || b.month - a.month) }
}

export async function readSeoTenant(query: AdminMenuQuery, slug: string): Promise<SeoTenant | null> {
  if (!SLUG.test(slug)) return null
  const { rows } = await query(`SELECT t.slug, t.custom_domain, t.custom_domain_verified, ${SUBDOMAIN}, t.updated_at, ${SITE_COLUMNS}
    FROM public.tenants t LEFT JOIN public.tenant_settings s ON s.tenant_id=t.id WHERE t.slug=$1 LIMIT 2`, [slug])
  if (rows.length !== 1) return null
  const row = rows[0]
  return seoTenant(row)
}

/** Only public brand identity is exposed; schema absence is distinct from DB failure. */
export async function readSiteBrand(query: AdminMenuQuery, brandId: string | null = null): Promise<SiteBrand | undefined> {
  const ready = (await query("SELECT to_regclass('public.brands') IS NOT NULL AS ready")).rows[0]?.ready === true
  if (!ready) {
    if (brandId) throw new Error('Assigned site brand is unavailable')
    return undefined
  }
  const { rows } = await query(`SELECT id, name, primary_host, extra_hosts, logo, icon, social_image,
    gtm_id, support_email, privacy_url, terms_url, show_powered_by, default_lang
    FROM public.brands WHERE id=$1 LIMIT 2`, [brandId ?? '00000000-0000-4000-8000-000000000001'])
  if (rows.length !== 1) throw new Error('Site brand is unavailable')
  const row = rows[0]
  return { id: String(row.id), name: String(row.name), primary_host: String(row.primary_host),
    extra_hosts: Array.isArray(row.extra_hosts) ? row.extra_hosts.filter((v): v is string => typeof v === 'string') : [],
    default_lang: String(row.default_lang), logo: label(row.logo), icon: label(row.icon), social_image: label(row.social_image),
    gtm_id: label(row.gtm_id), support_email: label(row.support_email), privacy_url: label(row.privacy_url),
    terms_url: label(row.terms_url), show_powered_by: row.show_powered_by === true }
}

export async function readTenantSitemapEntries(query: AdminMenuQuery, tenantId: string) {
  const [menus, locations] = await Promise.all([
    query('SELECT id, slug, is_default, is_private FROM public.menus WHERE tenant_id=$1 AND is_active=true ORDER BY position, id LIMIT 1000', [tenantId]),
    query('SELECT slug, menu_id, updated_at FROM public.locations WHERE tenant_id=$1 AND is_active=true ORDER BY created_at ASC, id LIMIT 1000', [tenantId]),
  ])
  return tenantSitemapCatalog(menus.rows, locations.rows)
}

/** Use the renderer's menu/branch precedence, including malformed multiple defaults. */
export function tenantSitemapCatalog(menuRows: Record<string, unknown>[], locationRows: Record<string, unknown>[]) {
  const menus = menuRows.map((row, index) => ({ id: String(row.id ?? index), slug: String(row.slug), is_default: row.is_default === true, is_private: row.is_private === true }))
  const locations = locationRows.map(row => ({ slug: String(row.slug), menu_id: label(row.menu_id), updated_at: iso(row.updated_at) }))
  const defaultMenu = pickDefaultMenu(menus)
  const publicLocations = locations.filter(location => pickSectionMenu(menus, location.slug, location)?.is_private !== true)
  return {
    rootIsPublic: locations.length >= 2 || defaultMenu?.is_private !== true,
    menus: menus.filter(menu => !menu.is_private && !locations.some(loc => loc.slug === menu.slug))
      .map(menu => ({ slug: menu.slug, is_default: menu === defaultMenu })),
    locations: publicLocations.map(({ slug, updated_at }) => ({ slug, updated_at })),
  }
}

export async function readOgTenant(query: AdminMenuQuery, slug: string) {
  if (!SLUG.test(slug)) return null
  const { rows } = await query(`SELECT t.name, s.primary_color, s.accent_color, s.tagline, s.logo_url FROM public.tenants t
    LEFT JOIN public.tenant_settings s ON s.tenant_id=t.id WHERE t.slug=$1 AND t.is_active=true LIMIT 2`, [slug])
  if (rows.length !== 1) return null
  const r = rows[0]
  const text = (v: unknown) => (typeof v === 'string' ? v : null)
  return { name: String(r.name), settings: { primary_color: text(r.primary_color) ?? undefined, accent_color: text(r.accent_color) ?? undefined, tagline: text(r.tagline), logo_url: text(r.logo_url) } }
}
