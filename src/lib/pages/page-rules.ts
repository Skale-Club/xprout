/**
 * Rules for a website page's address and what comes before it. A page lives at
 * /<restaurant>/<page-slug>, the same place menus and branches live, so a page
 * slug must never equal one of those or a reserved path.
 */

export const PAGE_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const PAGE_SLUG_MAX = 60

/**
 * Paths already served under a restaurant (child routes of /[slug]) plus the
 * platform's global first segments, which a custom domain never rewrites.
 */
export const RESERVED_PAGE_SLUGS: readonly string[] = [
  'me', 'blog', 'waiter', 'preview', 'robots.txt', 'sitemap.xml', 'manifest.webmanifest',
  'opengraph-image', 'twitter-image', 'rss.xml', 'feed',
  'api', 'checkout', 'auth', 'oauth', 'onboarding', 'privacy', 'terms', 'demo', 'brand', 'monitoring',
  'favicon.ico', 'icon.png', 'apple-icon.png',
]

export type SlugTaken = { menuSlugs: readonly string[]; branchSlugs: readonly string[] }
export type SlugCheck = { ok: true; slug: string } | { ok: false; error: string }

/** Lowercase kebab, 1-60 characters; not reserved; not a menu or branch of the same restaurant. */
export function checkPageSlug(input: unknown, taken: SlugTaken): SlugCheck {
  if (typeof input !== 'string') return { ok: false, error: 'Enter a page address' }
  const slug = input.trim().toLowerCase()
  if (!slug || slug.length > PAGE_SLUG_MAX || !PAGE_SLUG_PATTERN.test(slug)) {
    return { ok: false, error: 'Use lowercase letters, numbers and single dashes (up to 60 characters)' }
  }
  if (RESERVED_PAGE_SLUGS.includes(slug)) return { ok: false, error: 'This address is reserved' }
  if (taken.menuSlugs.some(menu => menu.toLowerCase() === slug)) return { ok: false, error: 'A menu already uses this address' }
  if (taken.branchSlugs.some(branch => branch.toLowerCase() === slug)) return { ok: false, error: 'A branch already uses this address' }
  return { ok: true, slug }
}

/** A readable default address from a title ("Our Story!" becomes "our-story"). */
export function slugFromTitle(title: string): string {
  return title.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, PAGE_SLUG_MAX).replace(/-+$/g, '')
}

export interface PageInput {
  slug: string; title: string; description: string; isPublished: boolean; showInNav: boolean
}

/** Fields of a page without its sections. */
export function parsePageInput(input: unknown, taken: SlugTaken): { ok: true; value: PageInput } | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Invalid page' }
  const body = input as Record<string, unknown>
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (title.length < 1 || title.length > 120) return { ok: false, error: 'Title must be 1 to 120 characters' }
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  if (description.length > 300) return { ok: false, error: 'Description can be up to 300 characters' }
  const slug = checkPageSlug(body.slug, taken)
  if (!slug.ok) return slug
  return { ok: true, value: { slug: slug.slug, title, description, isPublished: body.isPublished === true, showInNav: body.showInNav !== false } }
}

/** What a request for /<restaurant>/<x> resolves to: a menu or branch first (the menu loader), then a published page. */
export type SlugTarget = 'menu' | 'page' | 'not_found'
export function resolveSlugTarget(menuLoaderKind: 'menu' | 'branches' | 'not_found', hasPublishedPage: boolean): SlugTarget {
  if (menuLoaderKind === 'menu') return 'menu'
  return hasPublishedPage ? 'page' : 'not_found'
}
