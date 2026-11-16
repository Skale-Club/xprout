import { BRAND_URL } from '@/lib/brand'
import landingCopy from '@/lib/marketing/landing-copy.json'
import type { TenantSettings, BusinessHours, Category, Product, SpecialHours } from '@/types/database'
import { subdomainBase, tenantSubdomainHost } from './tenant-subdomain'

export const PLATFORM_BASE = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? BRAND_URL

/** Hostname (no scheme/port) of the platform domain — used for per-host robots/sitemap logic. */
export const PLATFORM_HOST = PLATFORM_BASE.replace(/^https?:\/\//, '').split(':')[0]

// Day names for schema.org DayOfWeek
const SCHEMA_DAYS: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday',
  thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
}

const LEGACY_HOST = 'xmartmenu.skale.club'

/** Rewrites an absolute URL on the legacy host to the platform host; everything else is returned unchanged. */
export function toPublicAssetUrl<T extends string | null | undefined>(url: T): T {
  if (!url) return url
  try {
    const u = new URL(url)
    if (u.hostname !== LEGACY_HOST) return url
    return `${PLATFORM_BASE}${u.pathname}${u.search}` as T
  } catch {
    return url
  }
}

export type CanonicalTenant = { slug: string; custom_domain?: string | null; custom_domain_verified?: boolean; subdomain?: string | null }

/**
 * The host a restaurant lives on when it is not the platform: its verified
 * custom domain, else its subdomain (<label>.<TENANT_SUBDOMAIN_BASE>, only
 * while that is configured), else null (platform slug path).
 */
export function tenantOwnHost(tenant: CanonicalTenant, base: string | null = subdomainBase()): string | null {
  if (tenant.custom_domain && tenant.custom_domain_verified) return tenant.custom_domain
  return tenantSubdomainHost(tenant.subdomain, base)
}

export function getCanonicalUrl(
  tenant: CanonicalTenant,
  path: string = '/',
): string {
  const host = tenantOwnHost(tenant)
  const base = host ? `https://${host}` : `${PLATFORM_BASE}/${tenant.slug}`
  const suffix = path === '/' ? '' : path.replace(/^\//, '')
  return suffix ? `${base}/${suffix}` : base
}

function parseHours(str: string): { opens: string; closes: string } | null {
  const match = str.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/)
  if (!match) return null
  const normalized = [match[1], match[2]].map(time => time.padStart(5, '0'))
  if (normalized.some(time => !/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(time))) return null
  return { opens: normalized[0], closes: normalized[1] }
}

function buildOpeningHours(hours: BusinessHours): object[] {
  return Object.entries(hours)
    .filter(([, v]) => typeof v === 'string' && v.trim())
    .flatMap(([day, value]) => {
      const parsed = parseHours(value!)
      if (!parsed || !SCHEMA_DAYS[day]) return []
      return [{
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: `https://schema.org/${SCHEMA_DAYS[day]}`,
        opens: parsed.opens,
        closes: parsed.closes,
      }]
    })
}

// ----- Local SEO building blocks (SEED-014) -----

interface AddressParts {
  streetAddress?: string | null
  city?: string | null
  region?: string | null
  postalCode?: string | null
  country?: string | null
}

/** schema.org PostalAddress, omitting empty parts. Returns null when fully empty. */
function buildPostalAddress(a: AddressParts): object | null {
  const entries: [string, string | null | undefined][] = [
    ['streetAddress', a.streetAddress],
    ['addressLocality', a.city],
    ['addressRegion', a.region],
    ['postalCode', a.postalCode],
    ['addressCountry', a.country],
  ]
  const filled = entries.filter(([, v]) => v && String(v).trim())
  if (!filled.length) return null
  return { '@type': 'PostalAddress', ...Object.fromEntries(filled) }
}

/** schema.org GeoCoordinates from lat/lng, or null when either is missing. */
function buildGeo(lat: number | null | undefined, lng: number | null | undefined): object | null {
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { '@type': 'GeoCoordinates', latitude: lat, longitude: lng }
}

/** Google Maps deep-link from coordinates (preferred) or a free-text address. */
function buildMapUrl(
  lat: number | null | undefined,
  lng: number | null | undefined,
  addressParts: (string | null | undefined)[],
): string | null {
  if (buildGeo(lat, lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
  }
  const q = addressParts.filter((p) => p && String(p).trim()).join(', ')
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null
}

/** Public profile URLs (Instagram, WhatsApp) surfaced as schema.org sameAs. */
export function buildSameAs(settings: { instagram?: string | null; whatsapp?: string | null; google_business_url?: string | null; facebook?: string | null; tripadvisor?: string | null; yelp?: string | null } | null): string[] {
  const out: string[] = []
  const ig = settings?.instagram?.trim()
  if (ig) {
    const url = /^https?:\/\//.test(ig) ? ig : `https://instagram.com/${ig.replace(/^@/, '')}`
    if (publicHttpsUrl(url)) out.push(url)
  }
  const wa = settings?.whatsapp?.trim()
  if (wa) {
    const digits = wa.replace(/[^\d]/g, '')
    if (digits) out.push(`https://wa.me/${digits}`)
  }
  for (const url of [settings?.google_business_url, settings?.facebook, settings?.tripadvisor, settings?.yelp]) {
    if (url && publicHttpsUrl(url)) out.push(url.trim())
  }
  return [...new Set(out)]
}

export const LOCAL_SEO_FIELDS = ['google_business_url', 'google_review_url', 'facebook', 'tripadvisor', 'yelp', 'accepts_reservations', 'reservation_url', 'special_hours', 'google_site_verification', 'bing_site_verification'] as const
const LOCAL_URL_FIELDS = ['google_business_url', 'google_review_url', 'facebook', 'tripadvisor', 'yelp', 'reservation_url'] as const

function publicHttpsUrl(value: string): boolean {
  if (value.length > 500 || /\s/u.test(value)) return false
  try { const url = new URL(value); return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password }
  catch { return false }
}

export function parseSpecialHours(value: unknown): SpecialHours[] | null {
  if (!Array.isArray(value) || value.length > 60) return null
  const output: SpecialHours[] = [], dates = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const row = item as Record<string, unknown>
    if (typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(row.date) || typeof row.closed !== 'boolean' || dates.has(row.date)) return null
    const date = new Date(`${row.date}T00:00:00Z`)
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== row.date) return null
    dates.add(row.date)
    if (row.closed) output.push({ date: row.date, closed: true })
    else {
      const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/u
      if (typeof row.opens !== 'string' || typeof row.closes !== 'string' || !time.test(row.opens) || !time.test(row.closes) || row.opens === row.closes) return null
      output.push({ date: row.date, closed: false, opens: row.opens, closes: row.closes })
    }
  }
  return output.sort((a, b) => a.date.localeCompare(b.date))
}

/** Only supplied local fields are returned, so older SEO clients cannot erase them. */
export function parseLocalSeoUpdate(body: Record<string, unknown>): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const value: Record<string, unknown> = {}
  for (const key of LOCAL_URL_FIELDS) {
    if (!(key in body)) continue
    const raw = body[key]
    if (raw === null || (typeof raw === 'string' && !raw.trim())) { value[key] = null; continue }
    if (typeof raw !== 'string' || !publicHttpsUrl(raw.trim())) return { ok: false, error: `Invalid ${key}` }
    value[key] = raw.trim()
  }
  if ('accepts_reservations' in body) {
    if (body.accepts_reservations !== null && typeof body.accepts_reservations !== 'boolean') return { ok: false, error: 'Invalid accepts_reservations' }
    value.accepts_reservations = body.accepts_reservations
  }
  if ('special_hours' in body) {
    const hours = parseSpecialHours(body.special_hours)
    if (!hours) return { ok: false, error: 'Invalid special_hours' }
    value.special_hours = hours
  }
  for (const key of ['google_site_verification', 'bing_site_verification'] as const) {
    if (!(key in body)) continue
    const raw = body[key]
    if (raw === null || (typeof raw === 'string' && !raw.trim())) { value[key] = null; continue }
    if (typeof raw !== 'string' || !/^[a-zA-Z0-9_-]{1,256}$/u.test(raw.trim())) return { ok: false, error: `Invalid ${key}` }
    value[key] = raw.trim()
  }
  return { ok: true, value }
}

export function buildSpecialHours(value: unknown): object[] {
  return (parseSpecialHours(value) ?? []).map(row => ({ '@type': 'OpeningHoursSpecification',
    validFrom: row.date, validThrough: row.date, opens: row.closed ? '00:00' : row.opens, closes: row.closed ? '00:00' : row.closes }))
}

export const restaurantEntityId = (url: string) => `${url.split('#')[0].replace(/\/$/u, '')}#restaurant`
export interface RestaurantJsonLdOptions {
  menuUrls?: string[]
  branches?: { name: string; url: string }[]
  areaServed?: string[]
}

export function buildLocalBusinessJsonLd(
  tenant: { name: string; slug: string; custom_domain?: string | null; custom_domain_verified?: boolean },
  settings: TenantSettings | null,
  canonicalUrl: string,
  options: RestaurantJsonLdOptions = {},
): object {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': restaurantEntityId(canonicalUrl),
    name: tenant.name,
    url: canonicalUrl,
    // The menu page IS the canonical home — link it as the restaurant's menu.
    menu: canonicalUrl,
    hasMenu: canonicalUrl,
  }

  if (settings?.tagline) ld.description = settings.tagline
  else if (settings?.about) ld.description = settings.about.slice(0, 300)

  if (settings?.phone) ld.telephone = settings.phone

  const address = buildPostalAddress({
    streetAddress: settings?.address,
    city: settings?.city,
    region: settings?.region,
    postalCode: settings?.postal_code,
    country: settings?.country,
  })
  if (address) ld.address = address

  const geo = buildGeo(settings?.latitude, settings?.longitude)
  if (geo) ld.geo = geo

  const mapUrl = buildMapUrl(settings?.latitude, settings?.longitude, [
    settings?.address, settings?.city, settings?.region, settings?.postal_code, settings?.country,
  ])
  if (mapUrl) ld.hasMap = mapUrl

  if (settings?.price_range?.trim()) ld.priceRange = settings.price_range.trim()

  if (settings?.logo_url) {
    ld.image = toPublicAssetUrl(settings.logo_url)
    ld.logo = toPublicAssetUrl(settings.logo_url)
  }

  if (settings?.business_type) {
    ld.servesCuisine = settings.business_type
  }

  if (settings?.business_hours) {
    const specs = buildOpeningHours(settings.business_hours)
    if (specs.length) ld.openingHoursSpecification = specs
  }

  const sameAs = buildSameAs(settings)
  if (sameAs.length) ld.sameAs = sameAs

  const specialHours = buildSpecialHours(settings?.special_hours)
  if (specialHours.length) ld.specialOpeningHoursSpecification = specialHours
  if (settings?.accepts_reservations === false) ld.acceptsReservations = false
  else if (settings?.accepts_reservations === true) ld.acceptsReservations = settings.reservation_url && publicHttpsUrl(settings.reservation_url) ? settings.reservation_url : true
  if (options.menuUrls?.length) ld.hasMenu = [...new Set(options.menuUrls.filter(publicHttpsUrl))].slice(0, 100)
  if (options.branches?.length) ld.department = options.branches.filter(branch => publicHttpsUrl(branch.url)).slice(0, 100)
    .map(branch => ({ '@type': 'Restaurant', '@id': restaurantEntityId(branch.url), name: branch.name, url: branch.url }))
  if (settings?.delivery_enabled && options.areaServed?.length) ld.areaServed = options.areaServed.filter(area => typeof area === 'string' && area.trim()).map(area => area.trim().slice(0, 200)).slice(0, 100)

  return ld
}

export function buildMenuJsonLd(
  menuName: string,
  menuUrl: string,
  categories: Category[],
  products: Product[],
  currency: string,
): object {
  const catMap = new Map(categories.map(c => [c.id, c]))

  const sections = categories
    .filter(cat => products.some(p => p.category_id === cat.id))
    .map(cat => ({
      '@type': 'MenuSection',
      name: cat.name,
      hasMenuItem: products
        .filter(p => p.category_id === cat.id)
        .slice(0, 50)
        .map(p => buildMenuItem(p, currency)),
    }))

  const uncategorized = products
    .filter(p => !p.category_id || !catMap.has(p.category_id))
    .slice(0, 50)

  if (uncategorized.length) {
    sections.push({
      '@type': 'MenuSection',
      name: 'Other',
      hasMenuItem: uncategorized.map(p => buildMenuItem(p, currency)),
    })
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: menuName,
    url: menuUrl,
    ...(sections.length ? { hasMenuSection: sections } : {}),
  }
}

// SEO-08 / Phase 43: per-branch LocalBusiness with branchOf link
export function buildBranchJsonLd(
  location: {
    name: string
    address: string | null
    city: string | null
    phone: string | null
    business_hours: Record<string, string> | null
    region?: string | null
    postal_code?: string | null
    country?: string | null
    latitude?: number | null
    longitude?: number | null
  },
  branchUrl: string,
  parentUrl: string,
  // Inherited from the parent tenant where the branch has no own value.
  inherited?: { priceRange?: string | null; sameAs?: string[]; specialHours?: SpecialHours[] | null; acceptsReservations?: boolean | null; reservationUrl?: string | null; menuUrls?: string[] } | null,
): object {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': restaurantEntityId(branchUrl),
    name: location.name,
    url: branchUrl,
    menu: branchUrl,
    hasMenu: branchUrl,
    branchOf: {
      '@type': 'Restaurant',
      '@id': restaurantEntityId(parentUrl),
    },
    parentOrganization: { '@type': 'Restaurant', '@id': restaurantEntityId(parentUrl) },
  }

  if (location.phone) ld.telephone = location.phone

  const address = buildPostalAddress({
    streetAddress: location.address,
    city: location.city,
    region: location.region,
    postalCode: location.postal_code,
    country: location.country,
  })
  if (address) ld.address = address

  const geo = buildGeo(location.latitude, location.longitude)
  if (geo) ld.geo = geo

  const mapUrl = buildMapUrl(location.latitude, location.longitude, [
    location.address, location.city, location.region, location.postal_code, location.country,
  ])
  if (mapUrl) ld.hasMap = mapUrl

  if (inherited?.priceRange?.trim()) ld.priceRange = inherited.priceRange.trim()
  if (inherited?.sameAs && inherited.sameAs.length) ld.sameAs = inherited.sameAs
  const specialHours = buildSpecialHours(inherited?.specialHours)
  if (specialHours.length) ld.specialOpeningHoursSpecification = specialHours
  if (typeof inherited?.acceptsReservations === 'boolean') ld.acceptsReservations = inherited.acceptsReservations && inherited.reservationUrl && publicHttpsUrl(inherited.reservationUrl) ? inherited.reservationUrl : inherited.acceptsReservations
  if (inherited?.menuUrls?.length) ld.hasMenu = inherited.menuUrls.filter(publicHttpsUrl).slice(0, 100)

  if (location.business_hours) {
    const specs = buildOpeningHours(location.business_hours)
    if (specs.length) ld.openingHoursSpecification = specs
  }

  return ld
}

function buildMenuItem(p: Product, currency: string): object {
  const item: Record<string, unknown> = {
    '@type': 'MenuItem',
    name: p.name,
    offers: {
      '@type': 'Offer',
      price: p.price.toFixed(2),
      priceCurrency: currency,
    },
  }
  if (p.description) item.description = p.description
  if (p.image_url) item.image = toPublicAssetUrl(p.image_url)
  return item
}

// ============================================================
// SEED-014: per-tenant SEO resolution helpers
// Prefer explicit tenant overrides (seo_*), then derive from existing
// branding/AI-copy fields, then fall back to a sensible default.
// ============================================================

type SeoTenant = { name: string }
type SeoSettings = Pick<
  TenantSettings,
  'seo_title' | 'seo_description' | 'seo_keywords' | 'seo_og_image_url' |
  'seo_noindex' | 'tagline' | 'about' | 'logo_url' | 'banner_url'
> | null

const clean = (s: string | null | undefined): string | null => {
  const t = s?.trim()
  return t ? t : null
}

export function resolveSeoTitle(tenant: SeoTenant, settings: SeoSettings, suffix?: string): string {
  const base = clean(settings?.seo_title) ?? tenant.name
  return suffix ? `${suffix} | ${base}` : base
}

export function resolveSeoDescription(tenant: SeoTenant, settings: SeoSettings, fallbackLabel?: string): string {
  return (
    clean(settings?.seo_description) ??
    clean(settings?.tagline) ??
    clean(settings?.about)?.slice(0, 160) ??
    `${fallbackLabel ?? 'View the full menu'} of ${tenant.name}`
  )
}

/** Comma-separated keyword list, normalized into an array (max 12). Empty when unset. */
export function resolveSeoKeywords(settings: SeoSettings): string[] {
  const raw = clean(settings?.seo_keywords)
  if (!raw) return []
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 12)
}

/** Explicit social-share image override (https). null means "use the generated branded card". */
export function resolveOgImageOverride(settings: SeoSettings): string | null {
  const url = clean(settings?.seo_og_image_url)
  return url && /^https:\/\//.test(url) ? toPublicAssetUrl(url) : null
}

export function isTenantNoindex(settings: SeoSettings): boolean {
  return settings?.seo_noindex === true
}

/** schema.org BreadcrumbList for richer SERP breadcrumbs. */
export function buildBreadcrumbJsonLd(items: { name: string; url: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

// ============================================================
// SEED-014: platform-level structured data (marketing landing)
// ============================================================

export function buildPlatformOrganizationJsonLd(opts: {
  name: string
  url: string
  description?: string | null
  logoUrl?: string | null
  sameAs?: string[]
}): object {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: opts.name,
    url: opts.url,
  }
  if (clean(opts.description)) ld.description = opts.description
  if (clean(opts.logoUrl)) ld.logo = toPublicAssetUrl(opts.logoUrl)
  if (opts.sameAs && opts.sameAs.length) ld.sameAs = opts.sameAs
  return ld
}

export function buildWebSiteJsonLd(opts: { name: string; url: string }): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: opts.name,
    url: opts.url,
  }
}

export function buildSoftwareApplicationJsonLd(opts: { name: string }): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: opts.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: landingCopy.seo.description,
  }
}
