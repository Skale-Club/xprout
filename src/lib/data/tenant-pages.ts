/**
 * Website pages on the owned database: admin CRUD, the public reads and the
 * contact-form submissions, all through an injected `query` (unit-tested without
 * a database; the runtime module opens the transaction).
 *
 * The code tolerates the schema not being applied yet: no pages are served, the
 * admin says "available after the next update" and writes answer 503.
 * Schema: docs/owned-schema/20261116180000_tenant_pages.sql.
 */
import { AdminMenuError, type AdminMenuQuery } from './admin-menus'
import type { AdminStoreContext } from './admin-store-settings'
import { parsePageInput, type SlugTaken } from '../pages/page-rules'
import { parseSectionsForRender, parseSectionsForWrite, type PageSection } from '../pages/sections'
import { parseContactSubmission, type ContactSubmission } from '../pages/contact-form'
import { planCeiling } from '../service-modes'

export const PAGES_READY_SQL = `SELECT count(*) = 8 AS ready FROM information_schema.columns
  WHERE table_schema='public' AND (
    (table_name='tenant_pages' AND column_name IN ('slug','title','sections','is_published','show_in_nav','sort_order'))
    OR (table_name='page_form_submissions' AND column_name IN ('page_id','message')))`

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_PAGES = 100

export type AdminPageRow = {
  id: string; slug: string; title: string; description: string
  is_published: boolean; show_in_nav: boolean; sort_order: number
  section_count: number; updated_at: string
}
export type AdminPageDetail = Omit<AdminPageRow, 'section_count'> & { sections: unknown[] }
export type AdminSubmission = { id: string; page_id: string; page_title: string; name: string; email: string; phone: string | null; message: string; created_at: string }

const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : String(value ?? ''))

function assertContext(context: AdminStoreContext) {
  if (!UUID.test(context.tenantId) || !['superadmin', 'store-admin', 'store-staff'].includes(context.role)) throw new AdminMenuError(403, 'Forbidden')
  // Owner settings: staff cannot read the submissions or change anything.
  if (context.role === 'store-staff') throw new AdminMenuError(403, 'Forbidden')
}

export async function pagesReady(query: AdminMenuQuery): Promise<boolean> {
  return (await query(PAGES_READY_SQL)).rows[0]?.ready === true
}
async function assertReady(query: AdminMenuQuery) {
  if (!(await pagesReady(query))) throw new AdminMenuError(503, 'Website pages are not available yet')
}

/** Menu and branch slugs of the restaurant: a page may not take one of them. */
export async function readTakenSlugs(query: AdminMenuQuery, tenantId: string): Promise<SlugTaken> {
  const [menus, branches] = await Promise.all([
    query('SELECT slug FROM public.menus WHERE tenant_id=$1 LIMIT 1000', [tenantId]),
    query('SELECT slug FROM public.locations WHERE tenant_id=$1 LIMIT 1000', [tenantId]),
  ])
  return { menuSlugs: menus.rows.map(row => String(row.slug)), branchSlugs: branches.rows.map(row => String(row.slug)) }
}

const DETAIL_COLUMNS = 'id, slug, title, description, sections, is_published, show_in_nav, sort_order, updated_at'
function detail(row: Record<string, unknown>): AdminPageDetail {
  return {
    id: String(row.id), slug: String(row.slug), title: String(row.title), description: String(row.description ?? ''),
    sections: Array.isArray(row.sections) ? row.sections : [], is_published: row.is_published === true,
    show_in_nav: row.show_in_nav === true, sort_order: Number(row.sort_order ?? 0), updated_at: iso(row.updated_at),
  }
}

/** In menu order; empty (not an error) until the schema step has run. */
export async function listAdminPages(query: AdminMenuQuery, context: AdminStoreContext): Promise<{ ready: boolean; pages: AdminPageRow[] }> {
  assertContext(context)
  if (!(await pagesReady(query))) return { ready: false, pages: [] }
  const { rows } = await query(`SELECT id, slug, title, description, is_published, show_in_nav, sort_order, updated_at, jsonb_array_length(sections) AS section_count
    FROM public.tenant_pages WHERE tenant_id=$1 ORDER BY sort_order, created_at, id LIMIT ${MAX_PAGES + 1}`, [context.tenantId])
  return {
    ready: true,
    pages: rows.slice(0, MAX_PAGES).map(row => ({
      id: String(row.id), slug: String(row.slug), title: String(row.title), description: String(row.description ?? ''),
      is_published: row.is_published === true, show_in_nav: row.show_in_nav === true, sort_order: Number(row.sort_order ?? 0),
      section_count: Number(row.section_count ?? 0), updated_at: iso(row.updated_at),
    })),
  }
}

export async function getAdminPage(query: AdminMenuQuery, context: AdminStoreContext, id: string): Promise<AdminPageDetail> {
  assertContext(context)
  if (!UUID.test(id)) throw new AdminMenuError(400, 'Invalid page')
  await assertReady(query)
  const { rows } = await query(`SELECT ${DETAIL_COLUMNS} FROM public.tenant_pages WHERE tenant_id=$1 AND id=$2 LIMIT 1`, [context.tenantId, id])
  if (!rows[0]) throw new AdminMenuError(404, 'Page not found')
  return detail(rows[0])
}

/** Body: { title, slug, description, isPublished, showInNav, sections? }. */
export async function createAdminPage(query: AdminMenuQuery, context: AdminStoreContext, body: unknown): Promise<AdminPageDetail> {
  assertContext(context)
  await assertReady(query)
  const parsed = parsePageInput(body, await readTakenSlugs(query, context.tenantId))
  if (!parsed.ok) throw new AdminMenuError(400, parsed.error)
  const sections = parseSectionsForWrite((body as { sections?: unknown }).sections ?? [])
  if (!sections.ok) throw new AdminMenuError(400, sections.error)
  const count = Number((await query('SELECT count(*)::int AS n FROM public.tenant_pages WHERE tenant_id=$1', [context.tenantId])).rows[0]?.n ?? 0)
  if (count >= MAX_PAGES) throw new AdminMenuError(409, `A restaurant can have up to ${MAX_PAGES} pages`)
  const input = parsed.value
  const { rows } = await query(`INSERT INTO public.tenant_pages (tenant_id, slug, title, description, sections, is_published, show_in_nav, sort_order)
    VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,(SELECT coalesce(max(sort_order),-1)+1 FROM public.tenant_pages WHERE tenant_id=$1))
    ON CONFLICT (tenant_id, slug) DO NOTHING RETURNING ${DETAIL_COLUMNS}`,
  [context.tenantId, input.slug, input.title, input.description, JSON.stringify(sections.value), input.isPublished, input.showInNav])
  if (!rows[0]) throw new AdminMenuError(409, 'You already have a page with this address')
  return detail(rows[0])
}

/** Replaces the page's fields and sections (the editor always sends the whole page). */
export async function updateAdminPage(query: AdminMenuQuery, context: AdminStoreContext, id: string, body: unknown): Promise<AdminPageDetail> {
  assertContext(context)
  if (!UUID.test(id)) throw new AdminMenuError(400, 'Invalid page')
  await assertReady(query)
  const parsed = parsePageInput(body, await readTakenSlugs(query, context.tenantId))
  if (!parsed.ok) throw new AdminMenuError(400, parsed.error)
  const sections = parseSectionsForWrite((body as { sections?: unknown }).sections ?? [])
  if (!sections.ok) throw new AdminMenuError(400, sections.error)
  const input = parsed.value
  const taken = await query('SELECT 1 FROM public.tenant_pages WHERE tenant_id=$1 AND slug=$2 AND id<>$3 LIMIT 1', [context.tenantId, input.slug, id])
  if (taken.rows.length > 0) throw new AdminMenuError(409, 'You already have a page with this address')
  const { rows } = await query(`UPDATE public.tenant_pages SET slug=$3, title=$4, description=$5, sections=$6::jsonb, is_published=$7, show_in_nav=$8, updated_at=now()
    WHERE tenant_id=$1 AND id=$2 RETURNING ${DETAIL_COLUMNS}`,
  [context.tenantId, id, input.slug, input.title, input.description, JSON.stringify(sections.value), input.isPublished, input.showInNav])
  if (!rows[0]) throw new AdminMenuError(404, 'Page not found')
  return detail(rows[0])
}

/** Ids in their new order after moving `id` one step; unchanged at the ends or for an unknown id. */
export function movePageId(ids: readonly string[], id: string, direction: 'up' | 'down'): string[] {
  const from = ids.indexOf(id)
  const to = direction === 'up' ? from - 1 : from + 1
  if (from < 0 || to < 0 || to >= ids.length) return [...ids]
  const next = [...ids]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

export async function moveAdminPage(query: AdminMenuQuery, context: AdminStoreContext, id: string, direction: unknown): Promise<{ ok: true }> {
  assertContext(context)
  if (!UUID.test(id) || (direction !== 'up' && direction !== 'down')) throw new AdminMenuError(400, 'Invalid request')
  await assertReady(query)
  const { rows } = await query('SELECT id FROM public.tenant_pages WHERE tenant_id=$1 ORDER BY sort_order, created_at, id LIMIT 1000 FOR UPDATE', [context.tenantId])
  const ids = rows.map(row => String(row.id))
  if (!ids.includes(id)) throw new AdminMenuError(404, 'Page not found')
  const next = movePageId(ids, id, direction)
  for (let index = 0; index < next.length; index++) {
    await query('UPDATE public.tenant_pages SET sort_order=$3 WHERE tenant_id=$1 AND id=$2', [context.tenantId, next[index], index])
  }
  return { ok: true }
}

export async function deleteAdminPage(query: AdminMenuQuery, context: AdminStoreContext, id: string): Promise<{ ok: true }> {
  assertContext(context)
  if (!UUID.test(id)) throw new AdminMenuError(400, 'Invalid page')
  await assertReady(query)
  const { rows } = await query('DELETE FROM public.tenant_pages WHERE tenant_id=$1 AND id=$2 RETURNING id', [context.tenantId, id])
  if (!rows[0]) throw new AdminMenuError(404, 'Page not found')
  return { ok: true }
}

/** Newest first, optionally for one page. */
export async function listAdminSubmissions(query: AdminMenuQuery, context: AdminStoreContext, pageId?: string | null): Promise<{ ready: boolean; submissions: AdminSubmission[] }> {
  assertContext(context)
  if (pageId && !UUID.test(pageId)) throw new AdminMenuError(400, 'Invalid page')
  if (!(await pagesReady(query))) return { ready: false, submissions: [] }
  const { rows } = await query(`SELECT f.id, f.page_id, p.title AS page_title, f.name, f.email, f.phone, f.message, f.created_at
    FROM public.page_form_submissions f JOIN public.tenant_pages p ON p.id=f.page_id
    WHERE f.tenant_id=$1 ${pageId ? 'AND f.page_id=$2' : ''} ORDER BY f.created_at DESC, f.id LIMIT 200`, pageId ? [context.tenantId, pageId] : [context.tenantId])
  return {
    ready: true,
    submissions: rows.map(row => ({
      id: String(row.id), page_id: String(row.page_id), page_title: String(row.page_title), name: String(row.name), email: String(row.email),
      phone: typeof row.phone === 'string' ? row.phone : null, message: String(row.message), created_at: iso(row.created_at),
    })),
  }
}

// ── Public reads ───────────────────────────────────────────────────────────

export type PublicPageNavItem = { slug: string; title: string }
export type PublicLocation = { name: string; slug: string | null; address: string | null; city: string | null; phone: string | null; business_hours: Record<string, string | null> | null }
export type PublicPage = {
  id: string; slug: string; title: string; description: string; updated_at: string
  sections: PageSection[]
  /** Branches (or the restaurant itself) for a locations section, read only when the page has one. */
  locations: PublicLocation[]
}
export type PublicPagesBundle = { nav: PublicPageNavItem[]; page: PublicPage | null }
export const NO_PUBLIC_PAGES: PublicPagesBundle = { nav: [], page: null }

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Whether the restaurant's plan carries the capability that enables pages (the one that enables the blog). */
async function planAllowsPages(query: AdminMenuQuery, tenantId: string): Promise<boolean> {
  const { rows } = await query(`SELECT s.status, p.features FROM public.tenant_subscriptions s LEFT JOIN public.plans p ON p.id=s.plan_id
    WHERE s.tenant_id=$1 LIMIT 2`, [tenantId])
  const row = rows.length === 1 ? rows[0] : null
  const features = row && ['active', 'trial'].includes(String(row.status)) && Array.isArray(row.features)
    ? row.features.filter((value): value is string => typeof value === 'string') : null
  return planCeiling(features).blog
}

const hours = (value: unknown): Record<string, string | null> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, string | null> : null
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)

/**
 * The published pages of a restaurant for the public site: the nav links and,
 * when `pageSlug` is given, that page (with its sections validated and the
 * automatic content of a locations section). Nothing until the schema step has
 * run or while the plan does not carry pages.
 */
export async function readPublicPages(query: AdminMenuQuery, tenantId: string, pageSlug: string | null): Promise<PublicPagesBundle> {
  if (!UUID.test(tenantId) || (pageSlug !== null && !SLUG.test(pageSlug))) return NO_PUBLIC_PAGES
  if (!(await pagesReady(query)) || !(await planAllowsPages(query, tenantId))) return NO_PUBLIC_PAGES
  const nav = (await query(`SELECT slug, title FROM public.tenant_pages WHERE tenant_id=$1 AND is_published=true AND show_in_nav=true
    ORDER BY sort_order, created_at, id LIMIT 12`, [tenantId])).rows.map(row => ({ slug: String(row.slug), title: String(row.title) }))
  if (pageSlug === null) return { nav, page: null }
  const row = (await query(`SELECT id, slug, title, description, sections, updated_at FROM public.tenant_pages
    WHERE tenant_id=$1 AND slug=$2 AND is_published=true LIMIT 2`, [tenantId, pageSlug])).rows
  if (row.length !== 1) return { nav, page: null }
  const sections = parseSectionsForRender(row[0].sections)
  let locations: PublicLocation[] = []
  if (sections.some(section => section.type === 'locations')) {
    const branches = (await query(`SELECT name, slug, address, city, phone, business_hours FROM public.locations
      WHERE tenant_id=$1 AND is_active=true ORDER BY created_at, id LIMIT 50`, [tenantId])).rows
    locations = branches.map(b => ({ name: String(b.name), slug: text(b.slug), address: text(b.address), city: text(b.city), phone: text(b.phone), business_hours: hours(b.business_hours) }))
    if (locations.length === 0) {
      const settings = (await query('SELECT address, phone, business_hours FROM public.tenant_settings WHERE tenant_id=$1 LIMIT 2', [tenantId])).rows
      const own = settings.length === 1 ? settings[0] : null
      if (own && (text(own.address) || text(own.phone) || hours(own.business_hours))) {
        locations = [{ name: '', slug: null, address: text(own.address), city: null, phone: text(own.phone), business_hours: hours(own.business_hours) }]
      }
    }
  }
  return {
    nav,
    page: { id: String(row[0].id), slug: String(row[0].slug), title: String(row[0].title), description: String(row[0].description ?? ''), updated_at: iso(row[0].updated_at), sections, locations },
  }
}

/** Published pages for the tenant sitemap (same gates as the public site). */
export async function readPublishedPageEntries(query: AdminMenuQuery, tenantId: string): Promise<Array<{ slug: string; updated_at: string }>> {
  if (!UUID.test(tenantId) || !(await pagesReady(query)) || !(await planAllowsPages(query, tenantId))) return []
  const { rows } = await query('SELECT slug, updated_at FROM public.tenant_pages WHERE tenant_id=$1 AND is_published=true ORDER BY sort_order, created_at, id LIMIT 200', [tenantId])
  return rows.map(row => ({ slug: String(row.slug), updated_at: iso(row.updated_at) }))
}

/**
 * Stores a contact-form submission of a published page that has a contact form.
 * Returns where the notification goes (the section's address, else `fallbackEmail`)
 * and the page title, or null when there is no such page or form.
 */
export async function storePageSubmission(
  query: AdminMenuQuery,
  tenantId: string,
  pageSlug: string,
  submission: ContactSubmission,
  fallbackEmail: string | null,
): Promise<{ pageTitle: string; notifyEmail: string | null } | null> {
  if (!UUID.test(tenantId) || !SLUG.test(pageSlug)) return null
  if (!(await pagesReady(query)) || !(await planAllowsPages(query, tenantId))) return null
  const found = (await query('SELECT id, title, sections FROM public.tenant_pages WHERE tenant_id=$1 AND slug=$2 AND is_published=true LIMIT 2', [tenantId, pageSlug])).rows
  if (found.length !== 1) return null
  const form = parseSectionsForRender(found[0].sections).find(section => section.type === 'contact_form')
  if (!form) return null
  // Re-validated here, never trusting the caller.
  const again = parseContactSubmission({ ...submission })
  if (!again.ok || 'spam' in again) return null
  await query('INSERT INTO public.page_form_submissions (tenant_id, page_id, name, email, phone, message) VALUES ($1,$2,$3,$4,$5,$6)',
    [tenantId, found[0].id, again.value.name, again.value.email, again.value.phone, again.value.message])
  return { pageTitle: String(found[0].title), notifyEmail: form.type === 'contact_form' && form.notifyEmail ? form.notifyEmail : fallbackEmail }
}
