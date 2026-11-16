type Finding = { ok: boolean; evidence: string }
const DAYS = new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])

function validHours(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  const type = row['@type']
  if (type !== 'OpeningHoursSpecification' && !(Array.isArray(type) && type.includes('OpeningHoursSpecification'))) return false
  const clock = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/u
  if (typeof row.opens !== 'string' || typeof row.closes !== 'string' || !clock.test(row.opens) || !clock.test(row.closes)) return false
  const days = Array.isArray(row.dayOfWeek) ? row.dayOfWeek : [row.dayOfWeek]
  return days.some(day => typeof day === 'string' && DAYS.has(day.replace(/^https?:\/\/schema\.org\//u, '')))
}

/** Presence of a public profile/map link proves neither listing ownership nor verification. */
function googleProfile(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port || /(?:^|\/)reviews?(?:\/|$)/iu.test(url.pathname)) return false
    if (url.hostname === 'g.page' || url.hostname === 'maps.app.goo.gl') return url.pathname.length > 1
    if (!['google.com', 'www.google.com', 'maps.google.com'].includes(url.hostname)) return false
    if (/\/(?:dir|search)(?:\/|$)/u.test(url.pathname)) return false
    return /^\/maps\/place\/[^/]+/u.test(url.pathname)
      || ((url.hostname === 'maps.google.com' || /^\/maps\/?$/u.test(url.pathname)) && /^\d+$/u.test(url.searchParams.get('cid') ?? ''))
  } catch { return false }
}

export function deriveLocalLaunchFindings(html: string): Record<string, Finding> {
  const restaurants: Record<string, unknown>[] = []
  const blocks = html.slice(0, 2_000_000).match(/<script[^>]+application\/ld\+json[^>]*>[\s\S]*?<\/script>/giu) ?? []
  for (const block of blocks.slice(0, 100)) {
    try {
      const parsed: unknown = JSON.parse(block.replace(/^<script[^>]*>/iu, '').replace(/<\/script>$/iu, ''))
      const root = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
      const nodes = Array.isArray(parsed) ? parsed : root && Array.isArray(root['@graph']) ? root['@graph'] : [root]
      for (const node of nodes.slice(0, 100)) {
        if (!node || typeof node !== 'object') continue
        const row = node as Record<string, unknown>, type = row['@type']
        if (type === 'Restaurant' || Array.isArray(type) && type.includes('Restaurant')) restaurants.push(row)
      }
    } catch { /* A malformed script is not launch evidence. */ }
  }
  if (!restaurants.length) return {}
  const hours = restaurants.some(row => (Array.isArray(row.openingHoursSpecification) ? row.openingHoursSpecification : [row.openingHoursSpecification]).slice(0, 100).some(validHours))
  const profile = restaurants.some(row => (Array.isArray(row.sameAs) ? row.sameAs : [row.sameAs]).slice(0, 100).some(googleProfile))
  return {
    local_hours: { ok: hours, evidence: hours ? 'Restaurant JSON-LD contains valid weekly opening hours; confirm they match the visible page and business schedule' : 'Restaurant JSON-LD has no valid weekly opening-hours specification' },
    gbp_link: { ok: profile, evidence: profile ? 'Restaurant sameAs includes an HTTPS Google business/profile map link; listing ownership and verification remain manual' : 'Restaurant sameAs has no recognized public HTTPS Google business/profile map link' },
  }
}
