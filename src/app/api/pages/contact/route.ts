import { NextResponse } from 'next/server'
import { getTenantBySlug } from '@/lib/menu/public-menu-data'
import { tenantPagesAvailable, storeOwnedSubmission } from '@/lib/data/tenant-pages-runtime'
import { parseContactSubmission, sendContactEmail } from '@/lib/pages/contact-form'
import { contactEmailFor } from '@/lib/public-contacts'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { AdminMenuError } from '@/lib/data/admin-menus'
import { withApi } from '@/lib/observability/with-api'
import { log } from '@/lib/observability/log'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

/**
 * Public contact form of a website page. Body: { slug, page, name, email, phone?, message, website }
 * where `website` is the honeypot (hidden from people). Stores the submission and
 * emails the restaurant when an address is known; the email never decides the answer.
 */
async function handlePOST(request: Request) {
  const ip = getClientIp(request)
  if (!(await rateLimit('page-contact', ip, 5, '10 m')).ok) return json({ error: 'Too many messages. Please try again later.' }, 429)
  let body: unknown
  try { body = await request.json() } catch { return json({ error: 'Invalid request' }, 400) }
  const fields = body as Record<string, unknown>
  const parsed = parseContactSubmission(body)
  if (!parsed.ok) return json({ error: parsed.error }, 400)
  if ('spam' in parsed) return json({ ok: true })
  if (typeof fields.slug !== 'string' || typeof fields.page !== 'string' || !SLUG.test(fields.slug) || !SLUG.test(fields.page)) return json({ error: 'Invalid request' }, 400)
  if (!tenantPagesAvailable()) return json({ error: 'This form is not available' }, 503)

  const tenant = await getTenantBySlug(fields.slug)
  if (!tenant) return json({ error: 'Page not found' }, 404)
  try {
    const stored = await storeOwnedSubmission(tenant.id, fields.page, parsed.value, contactEmailFor(tenant.slug))
    if (!stored) return json({ error: 'Page not found' }, 404)
    if (stored.notifyEmail) {
      await sendContactEmail({ to: stored.notifyEmail, restaurantName: tenant.name, pageTitle: stored.pageTitle, submission: parsed.value })
    }
    return json({ ok: true })
  } catch (error) {
    if (!(error instanceof AdminMenuError) || error.status >= 500) log.error('pages.contact_error', { err: error })
    return json({ error: 'The message could not be sent. Please try again.' }, 503)
  }
}

export const POST = withApi('POST /api/pages/contact', handlePOST)
