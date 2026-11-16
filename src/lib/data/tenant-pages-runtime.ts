import { unstable_cache } from 'next/cache'
import { adminMenusOwned } from './admin-menus'
import { ownedAdminTransaction } from './admin-menus-runtime'
import type { AdminStoreContext } from './admin-store-settings'
import {
  createAdminPage, deleteAdminPage, getAdminPage, listAdminPages, listAdminSubmissions, moveAdminPage, NO_PUBLIC_PAGES,
  readPublicPages, readPublishedPageEntries, storePageSubmission, updateAdminPage, type PublicPagesBundle,
} from './tenant-pages'
import type { ContactSubmission } from '../pages/contact-form'
import { menuCacheTags, publicMenuCacheSeconds } from '../menu/public-menu-cache'
import { log } from '../observability/log'
import { scheduleTenantPublish } from '../site/publish-effects-runtime'

/**
 * Pages exist on the owned database only: in the legacy (Supabase development)
 * mode there are no pages, the admin says so, and the public site is unchanged.
 */
export const tenantPagesAvailable = () => adminMenusOwned()

// ── Admin ──────────────────────────────────────────────────────────────────
export const listOwnedPages = (context: AdminStoreContext) => ownedAdminTransaction(false, query => listAdminPages(query, context))
export const getOwnedPage = (context: AdminStoreContext, id: string) => ownedAdminTransaction(false, query => getAdminPage(query, context, id))
export const createOwnedPage = async (context: AdminStoreContext, body: unknown) => {
  const result = await ownedAdminTransaction(true, query => createAdminPage(query, context, body))
  scheduleTenantPublish(context.tenantId, [`/${result.slug}`]); return result
}
export const updateOwnedPage = async (context: AdminStoreContext, id: string, body: unknown) => {
  const result = await ownedAdminTransaction(true, query => updateAdminPage(query, context, id, body))
  scheduleTenantPublish(context.tenantId, [`/${result.slug}`]); return result
}
export const moveOwnedPage = (context: AdminStoreContext, id: string, direction: unknown) => ownedAdminTransaction(true, query => moveAdminPage(query, context, id, direction))
export const deleteOwnedPage = async (context: AdminStoreContext, id: string) => {
  const result = await ownedAdminTransaction(true, async query => {
    const page = await getAdminPage(query, context, id)
    await deleteAdminPage(query, context, id)
    return { ok: true, slug: page.slug }
  })
  scheduleTenantPublish(context.tenantId, [`/${result.slug}`]); return { ok: true }
}
export const listOwnedSubmissions = (context: AdminStoreContext, pageId?: string | null) => ownedAdminTransaction(false, query => listAdminSubmissions(query, context, pageId))

// ── Public ─────────────────────────────────────────────────────────────────
function readPublic(tenantId: string, pageSlug: string | null): Promise<PublicPagesBundle> {
  return ownedAdminTransaction(false, query => readPublicPages(query, tenantId, pageSlug))
}

/**
 * The nav links (and a page) of a restaurant, cached like the public menu: 60 s
 * per restaurant, dropped by revalidatePublicMenu(slug) when the owner saves.
 * Throws when the database is unavailable; callers decide whether that matters.
 */
export async function loadPublicPages(tenant: { id: string; slug: string }, pageSlug: string | null): Promise<PublicPagesBundle> {
  if (!tenantPagesAvailable()) return NO_PUBLIC_PAGES
  const seconds = publicMenuCacheSeconds()
  if (seconds <= 0) return readPublic(tenant.id, pageSlug)
  return unstable_cache(
    () => readPublic(tenant.id, pageSlug),
    ['tenant-pages', 'v1', tenant.slug.toLowerCase(), pageSlug ?? ''],
    { revalidate: seconds, tags: menuCacheTags(tenant.slug) },
  )()
}

/** Nav links only; a failure hides the links, it never breaks the menu. */
export async function loadPublicPageNav(tenant: { id: string; slug: string }): Promise<Array<{ slug: string; title: string }>> {
  try { return (await loadPublicPages(tenant, null)).nav } catch (err) {
    log.error('pages.nav_error', { err })
    return []
  }
}

export const ownedPublishedPageEntries = (tenantId: string) => ownedAdminTransaction(false, query => readPublishedPageEntries(query, tenantId))

/** Stores a submission; resolves null when the page or its form does not exist. */
export const storeOwnedSubmission = (tenantId: string, pageSlug: string, submission: ContactSubmission, fallbackEmail: string | null) =>
  ownedAdminTransaction(true, query => storePageSubmission(query, tenantId, pageSlug, submission, fallbackEmail))
