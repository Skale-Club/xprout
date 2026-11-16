import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  NO_PUBLIC_PAGES, PAGES_READY_SQL, createAdminPage, listAdminPages, movePageId, readPublicPages, readPublishedPageEntries, storePageSubmission,
} from '@/lib/data/tenant-pages'
import { AdminMenuError, type AdminMenuQuery } from '@/lib/data/admin-menus'
import { checkPageSlug, parsePageInput, resolveSlugTarget, RESERVED_PAGE_SLUGS, slugFromTitle } from '@/lib/pages/page-rules'
import { parseSectionsForRender, parseSectionsForWrite, sectionSchema, splitParagraphs } from '@/lib/pages/sections'
import { parseContactSubmission, sendContactEmail } from '@/lib/pages/contact-form'
import { getMenuCopy } from '@/components/menu/menu-i18n'

const tenantId = randomUUID()
const owner = { tenantId, role: 'store-admin' as const }
const none = { menuSlugs: [] as string[], branchSlugs: [] as string[] }

// ── Sections ────────────────────────────────────────────────────────────────
describe('section validation', () => {
  const ok = (section: unknown) => sectionSchema.safeParse(section).success

  it('accepts each of the six types', () => {
    expect(ok({ id: 'a', type: 'text_image', body: 'Hello', imageSide: 'left', image: 'https://cdn.example.com/a.webp' })).toBe(true)
    expect(ok({ id: 'b', type: 'cards', heading: 'Team', items: [{ title: 'Ana', subtitle: 'Chef', text: 'Hi', image: 'https://cdn.example.com/a.webp' }] })).toBe(true)
    expect(ok({ id: 'c', type: 'faq', items: [{ question: 'Open?', answer: 'Yes' }] })).toBe(true)
    expect(ok({ id: 'd', type: 'locations', heading: 'Find us' })).toBe(true)
    expect(ok({ id: 'e', type: 'contact_form', intro: 'Write to us', notifyEmail: 'owner@example.com' })).toBe(true)
    expect(ok({ id: 'f', type: 'button_link', label: 'Apply', url: 'https://jobs.example.com/apply' })).toBe(true)
  })

  it('refuses unknown types and embeds', () => {
    expect(ok({ id: 'a', type: 'iframe', url: 'https://example.com' })).toBe(false)
    expect(ok({ id: 'a', type: 'html', body: '<b>x</b>' })).toBe(false)
  })

  it('enforces the limits', () => {
    expect(ok({ id: 'a', type: 'text_image', body: 'x'.repeat(5000) })).toBe(true)
    expect(ok({ id: 'a', type: 'text_image', body: 'x'.repeat(5001) })).toBe(false)
    expect(ok({ id: 'a', type: 'text_image', body: '   ' })).toBe(false)
    const cards = (n: number) => ({ id: 'a', type: 'cards', items: Array.from({ length: n }, () => ({ title: 'T' })) })
    expect(ok(cards(24))).toBe(true)
    expect(ok(cards(25))).toBe(false)
    const faq = (n: number) => ({ id: 'a', type: 'faq', items: Array.from({ length: n }, () => ({ question: 'Q', answer: 'A' })) })
    expect(ok(faq(30))).toBe(true)
    expect(ok(faq(31))).toBe(false)
    expect(ok({ id: 'a', type: 'cards', items: [{ title: '' }] })).toBe(false)
    expect(ok({ id: 'a', type: 'button_link', label: 'x'.repeat(61), url: 'https://a.example.com' })).toBe(false)
  })

  it('accepts https links only, up to 500 characters', () => {
    const link = (url: string) => ok({ id: 'a', type: 'button_link', label: 'Go', url })
    expect(link('https://example.com/a')).toBe(true)
    expect(link('http://example.com/a')).toBe(false)
    expect(link('javascript:alert(1)')).toBe(false)
    expect(link('//example.com')).toBe(false)
    expect(link('https://example.com/has space')).toBe(false)
    expect(link(`https://example.com/${'a'.repeat(500)}`)).toBe(false)
    expect(ok({ id: 'a', type: 'text_image', body: 'x', image: 'http://cdn.example.com/a.webp' })).toBe(false)
    expect(ok({ id: 'a', type: 'text_image', body: 'x', image: 'data:image/png;base64,AAAA' })).toBe(false)
  })

  it('treats empty optional text as not set', () => {
    const parsed = sectionSchema.parse({ id: 'a', type: 'text_image', body: 'Hi', heading: '  ', image: '' })
    expect(parsed).toMatchObject({ body: 'Hi', imageSide: 'right' })
    expect('heading' in parsed && parsed.heading).toBeFalsy()
    expect('image' in parsed && parsed.image).toBeFalsy()
  })

  it('write refuses the whole page when one section is invalid, with a readable message', () => {
    const result = parseSectionsForWrite([{ id: 'a', type: 'locations' }, { id: 'b', type: 'faq', items: [{ question: '', answer: 'x' }] }])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/^Section 2 has a problem/)
    expect(parseSectionsForWrite([{ id: 'a', type: 'locations' }, { id: 'a', type: 'locations' }]).ok).toBe(false)
    expect(parseSectionsForWrite(Array.from({ length: 41 }, (_, i) => ({ id: `s${i}`, type: 'locations' }))).ok).toBe(false)
    expect(parseSectionsForWrite('nope').ok).toBe(false)
  })

  it('render skips unknown and invalid sections and keeps the valid ones in order', () => {
    const rendered = parseSectionsForRender([
      { id: 'a', type: 'locations' },
      { id: 'b', type: 'video', url: 'https://x.example.com' },
      { id: 'c', type: 'button_link', label: 'Go', url: 'http://insecure.example.com' },
      null,
      'text',
      { id: 'd', type: 'faq', items: [{ question: 'Q', answer: 'A' }] },
    ])
    expect(rendered.map(section => section.id)).toEqual(['a', 'd'])
    expect(parseSectionsForRender(undefined)).toEqual([])
    expect(parseSectionsForRender({ id: 'a' })).toEqual([])
  })

  it('splits plain text into paragraphs by blank line', () => {
    expect(splitParagraphs('One\nstill one\n\nTwo\n \n\n  Three  ')).toEqual(['One\nstill one', 'Two', 'Three'])
  })
})

// ── Slugs and routing ───────────────────────────────────────────────────────
describe('page slugs', () => {
  it('accepts lowercase kebab of 1 to 60 characters and lowercases input', () => {
    expect(checkPageSlug('our-story', none)).toEqual({ ok: true, slug: 'our-story' })
    expect(checkPageSlug('  Careers ', none)).toEqual({ ok: true, slug: 'careers' })
    expect(checkPageSlug('a'.repeat(60), none).ok).toBe(true)
    expect(checkPageSlug('a'.repeat(61), none).ok).toBe(false)
    for (const bad of ['', 'two--dashes', '-lead', 'trail-', 'has space', 'under_score', 'dot.dot', 'ção', 42, null]) expect(checkPageSlug(bad, none).ok).toBe(false)
  })

  it('refuses reserved paths', () => {
    for (const reserved of ['me', 'blog', 'waiter', 'preview', 'api', 'checkout']) expect(checkPageSlug(reserved, none)).toEqual({ ok: false, error: 'This address is reserved' })
    for (const file of ['robots.txt', 'sitemap.xml', 'manifest.webmanifest']) {
      expect(RESERVED_PAGE_SLUGS).toContain(file)
      expect(checkPageSlug(file, none).ok).toBe(false)
    }
  })

  it('refuses a slug that a menu or a branch of the restaurant already uses', () => {
    const taken = { menuSlugs: ['drinks', 'Lunch'], branchSlugs: ['downtown'] }
    expect(checkPageSlug('drinks', taken)).toEqual({ ok: false, error: 'A menu already uses this address' })
    expect(checkPageSlug('lunch', taken).ok).toBe(false)
    expect(checkPageSlug('downtown', taken)).toEqual({ ok: false, error: 'A branch already uses this address' })
    expect(checkPageSlug('team', taken).ok).toBe(true)
  })

  it('builds a default address from a title', () => {
    expect(slugFromTitle('Our Story!')).toBe('our-story')
    expect(slugFromTitle('Café & Bar — Catering')).toBe('cafe-bar-catering')
    expect(slugFromTitle('!!!')).toBe('')
  })

  it('validates the page fields', () => {
    expect(parsePageInput({ title: 'Team', slug: 'team', description: 'x', isPublished: true }, none)).toMatchObject({ ok: true, value: { slug: 'team', isPublished: true, showInNav: true } })
    expect(parsePageInput({ title: '', slug: 'team' }, none).ok).toBe(false)
    expect(parsePageInput({ title: 'T', slug: 'team', description: 'x'.repeat(301) }, none).ok).toBe(false)
    expect(parsePageInput({ title: 'T'.repeat(121), slug: 'team' }, none).ok).toBe(false)
    expect(parsePageInput({ title: 'T', slug: 'me' }, none).ok).toBe(false)
    expect(parsePageInput(null, none).ok).toBe(false)
  })

  it('resolves /<slug>/<x> as menu, then branch (the menu loader), then published page, then 404', () => {
    expect(resolveSlugTarget('menu', true)).toBe('menu')
    expect(resolveSlugTarget('menu', false)).toBe('menu')
    expect(resolveSlugTarget('not_found', true)).toBe('page')
    expect(resolveSlugTarget('not_found', false)).toBe('not_found')
    expect(resolveSlugTarget('branches', false)).toBe('not_found')
  })
})

// ── Contact form ────────────────────────────────────────────────────────────
describe('contact form', () => {
  const valid = { name: ' Ana ', email: 'ANA@Example.com', phone: '', message: ' Hello ', website: '' }

  it('validates and normalizes', () => {
    expect(parseContactSubmission(valid)).toEqual({ ok: true, value: { name: 'Ana', email: 'ana@example.com', phone: null, message: 'Hello' } })
    expect(parseContactSubmission({ ...valid, phone: '555 1234' })).toMatchObject({ ok: true, value: { phone: '555 1234' } })
    for (const bad of [{ name: '' }, { email: 'nope' }, { email: 'a@b' }, { message: '' }, { message: 'x'.repeat(3001) }, { name: 'x'.repeat(121) }, { phone: 'x'.repeat(41) }]) {
      expect(parseContactSubmission({ ...valid, ...bad }).ok).toBe(false)
    }
    expect(parseContactSubmission('x').ok).toBe(false)
  })

  it('answers a filled honeypot as a silent success and keeps nothing', () => {
    expect(parseContactSubmission({ ...valid, website: 'http://spam.example.com' })).toEqual({ ok: true, spam: true })
  })

  it('does not send in development, never throws, and escapes the message when it sends', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }))
    const input = { to: 'owner@example.com', restaurantName: 'Aurora', pageTitle: 'Contact', submission: { name: '<b>Ana</b>', email: 'ana@example.com', phone: null, message: '<script>x</script>' } }
    const base = { RESEND_API_KEY: 'key', ORDER_EMAIL_FROM: 'orders@example.com' }
    expect(await sendContactEmail(input, { env: { ...base, NODE_ENV: 'development' }, fetchImpl })).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(await sendContactEmail(input, { env: { ...base, NODE_ENV: 'production' }, fetchImpl })).toBe(true)
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, { body: string }])[1].body) as { html: string; to: string[]; reply_to: string }
    expect(body.to).toEqual(['owner@example.com'])
    expect(body.reply_to).toBe('ana@example.com')
    expect(body.html).not.toContain('<script>')
    expect(body.html).toContain('&lt;script&gt;')
    const failing = vi.fn(async () => { throw new Error('network') })
    expect(await sendContactEmail(input, { env: { ...base, NODE_ENV: 'production' }, fetchImpl: failing as unknown as typeof fetch })).toBe(false)
  })

  it('has its labels in every menu language', () => {
    for (const lang of ['en', 'pt', 'es', 'fr', 'de', 'it', 'nl', 'pl', 'tr', 'ru', 'hi', 'ja', 'ko', 'zh', 'zh-TW']) {
      const copy = getMenuCopy(lang)
      for (const key of ['pagesMore', 'pageName', 'pageEmail', 'pagePhone', 'pageMessage', 'pageSend', 'pageSending', 'pageSent', 'pageSendError', 'pageOpenMaps', 'pageViewMenu'] as const) {
        expect(copy[key], `${lang}.${key}`).toBeTruthy()
      }
    }
  })
})

// ── Data layer (fake database) ──────────────────────────────────────────────
type PageRow = { id: string; slug: string; title: string; description: string; sections: unknown; is_published: boolean; show_in_nav: boolean; sort_order: number; updated_at: Date }

function fakeDb(options: { ready?: boolean; features?: string[] | null; pages?: PageRow[]; menus?: string[]; branches?: Array<Record<string, unknown>> } = {}) {
  const pages = options.pages ?? []
  const log: Array<{ text: string; values: unknown[] }> = []
  const inserted: unknown[][] = []
  const query: AdminMenuQuery = async (text, values = []) => {
    log.push({ text, values })
    if (text === PAGES_READY_SQL) return { rows: [{ ready: options.ready ?? true }] }
    if (text.includes('FROM public.tenant_subscriptions')) return { rows: options.features === null ? [] : [{ status: 'active', features: options.features ?? ['blog'] }] }
    if (text.startsWith('SELECT slug FROM public.menus')) return { rows: (options.menus ?? []).map(slug => ({ slug })) }
    if (text.startsWith('SELECT slug FROM public.locations')) return { rows: (options.branches ?? []).map(b => ({ slug: b.slug })) }
    if (text.includes('count(*)::int AS n FROM public.tenant_pages')) return { rows: [{ n: pages.length }] }
    if (text.startsWith('INSERT INTO public.tenant_pages')) {
      const [, slug, title] = values as string[]
      if (pages.some(p => p.slug === slug)) return { rows: [] }
      return { rows: [{ id: randomUUID(), slug, title, description: values[3], sections: JSON.parse(String(values[4])), is_published: values[5], show_in_nav: values[6], sort_order: 0, updated_at: new Date() }] }
    }
    if (text.includes('jsonb_array_length(sections)')) return { rows: pages.map(p => ({ ...p, section_count: Array.isArray(p.sections) ? p.sections.length : 0 })) }
    if (text.includes('AND is_published=true AND show_in_nav=true')) return { rows: pages.filter(p => p.is_published && p.show_in_nav) }
    if (text.includes('SELECT id, slug, title, description, sections, updated_at FROM public.tenant_pages')) return { rows: pages.filter(p => p.slug === values[1] && p.is_published) }
    if (text.includes('SELECT slug, updated_at FROM public.tenant_pages')) return { rows: pages.filter(p => p.is_published) }
    if (text.includes('SELECT id, title, sections FROM public.tenant_pages')) return { rows: pages.filter(p => p.slug === values[1] && p.is_published) }
    if (text.includes('FROM public.locations')) return { rows: options.branches ?? [] }
    if (text.includes('FROM public.tenant_settings')) return { rows: [{ address: '1 Main St', phone: '555-0100', business_hours: { mon: '9-5' } }] }
    if (text.startsWith('INSERT INTO public.page_form_submissions')) { inserted.push(values); return { rows: [] } }
    throw new Error(`Unexpected query: ${text}`)
  }
  return { query, log, inserted }
}

const row = (over: Partial<PageRow> = {}): PageRow => ({
  id: randomUUID(), slug: 'team', title: 'Team', description: '', sections: [], is_published: true, show_in_nav: true, sort_order: 0, updated_at: new Date('2026-11-16T12:00:00Z'), ...over,
})

describe('readiness fallback', () => {
  it('admin list is empty and "not ready" until the schema ran; writes answer 503', async () => {
    const db = fakeDb({ ready: false })
    expect(await listAdminPages(db.query, owner)).toEqual({ ready: false, pages: [] })
    await expect(createAdminPage(db.query, owner, { title: 'T', slug: 'team' })).rejects.toMatchObject({ status: 503 })
  })

  it('the public site has no pages and no nav until the schema ran', async () => {
    const db = fakeDb({ ready: false })
    expect(await readPublicPages(db.query, tenantId, 'team')).toBe(NO_PUBLIC_PAGES)
    expect(await readPublishedPageEntries(db.query, tenantId)).toEqual([])
    expect(db.log.every(entry => entry.text === PAGES_READY_SQL)).toBe(true)
  })

  it('uses information_schema, never a table that may be missing', () => {
    expect(PAGES_READY_SQL).toContain('information_schema.columns')
    expect(PAGES_READY_SQL).toContain("table_name='tenant_pages'")
    expect(PAGES_READY_SQL).toContain("table_name='page_form_submissions'")
  })

  it('staff cannot read or change pages', async () => {
    const db = fakeDb()
    await expect(listAdminPages(db.query, { tenantId, role: 'store-staff' })).rejects.toBeInstanceOf(AdminMenuError)
  })
})

describe('admin writes', () => {
  it('refuses a slug that a menu or a branch already uses, before touching the table', async () => {
    const db = fakeDb({ menus: ['drinks'], branches: [{ slug: 'downtown' }] })
    await expect(createAdminPage(db.query, owner, { title: 'Drinks', slug: 'drinks' })).rejects.toMatchObject({ status: 400, message: 'A menu already uses this address' })
    await expect(createAdminPage(db.query, owner, { title: 'Downtown', slug: 'downtown' })).rejects.toMatchObject({ status: 400 })
    await expect(createAdminPage(db.query, owner, { title: 'Me', slug: 'me' })).rejects.toMatchObject({ status: 400 })
    expect(db.log.some(entry => entry.text.startsWith('INSERT'))).toBe(false)
  })

  it('refuses invalid sections', async () => {
    const db = fakeDb()
    await expect(createAdminPage(db.query, owner, { title: 'T', slug: 'jobs', sections: [{ id: 'a', type: 'button_link', label: 'Apply', url: 'http://x.example.com' }] })).rejects.toMatchObject({ status: 400 })
  })

  it('creates a page and reports a duplicate address as 409', async () => {
    const created = await createAdminPage(fakeDb().query, owner, { title: 'Jobs', slug: 'jobs', isPublished: true, sections: [{ id: 'a', type: 'locations' }] })
    expect(created).toMatchObject({ slug: 'jobs', is_published: true })
    expect(created.sections).toHaveLength(1)
    await expect(createAdminPage(fakeDb({ pages: [row({ slug: 'jobs' })] }).query, owner, { title: 'Jobs', slug: 'jobs' })).rejects.toMatchObject({ status: 409 })
  })

  it('moves a page one step in the order', () => {
    expect(movePageId(['a', 'b', 'c'], 'b', 'up')).toEqual(['b', 'a', 'c'])
    expect(movePageId(['a', 'b', 'c'], 'b', 'down')).toEqual(['a', 'c', 'b'])
    expect(movePageId(['a', 'b', 'c'], 'a', 'up')).toEqual(['a', 'b', 'c'])
    expect(movePageId(['a', 'b', 'c'], 'c', 'down')).toEqual(['a', 'b', 'c'])
    expect(movePageId(['a', 'b'], 'zzz', 'down')).toEqual(['a', 'b'])
  })
})

describe('public reads', () => {
  it('serves nothing when the plan does not carry the blog capability that enables pages', async () => {
    const db = fakeDb({ features: [], pages: [row()] })
    expect(await readPublicPages(db.query, tenantId, 'team')).toBe(NO_PUBLIC_PAGES)
    expect(await readPublicPages(fakeDb({ features: null, pages: [row()] }).query, tenantId, null)).toBe(NO_PUBLIC_PAGES)
  })

  it('returns the nav links and the published page, with invalid sections skipped', async () => {
    const db = fakeDb({
      pages: [
        row({ slug: 'team', title: 'Team', sections: [{ id: 'a', type: 'faq', items: [{ question: 'Q', answer: 'A' }] }, { id: 'b', type: 'unknown' }, { id: 'c', type: 'button_link', label: 'x', url: 'http://bad.example.com' }] }),
        row({ slug: 'draft', title: 'Draft', is_published: false }),
        row({ slug: 'hidden', title: 'Hidden', show_in_nav: false }),
      ],
    })
    const bundle = await readPublicPages(db.query, tenantId, 'team')
    expect(bundle.nav.map(link => link.slug)).toEqual(['team'])
    expect(bundle.page?.sections.map(section => section.id)).toEqual(['a'])
    expect(bundle.page?.locations).toEqual([])
    expect((await readPublicPages(db.query, tenantId, 'draft')).page).toBeNull()
    expect((await readPublicPages(db.query, tenantId, 'Bad Slug!')).page).toBeNull()
  })

  it('reads the automatic content of a locations section from the branches, else from the restaurant', async () => {
    const sections = [{ id: 'l', type: 'locations' }]
    const withBranches = fakeDb({ pages: [row({ sections })], branches: [{ name: 'Downtown', slug: 'downtown', address: '2 Oak St', city: 'Miami', phone: '555', business_hours: { mon: '9-5', tue: null } }] })
    const branchPage = (await readPublicPages(withBranches.query, tenantId, 'team')).page
    expect(branchPage?.locations).toEqual([{ name: 'Downtown', slug: 'downtown', address: '2 Oak St', city: 'Miami', phone: '555', business_hours: { mon: '9-5', tue: null } }])
    const own = (await readPublicPages(fakeDb({ pages: [row({ sections })] }).query, tenantId, 'team')).page
    expect(own?.locations).toEqual([{ name: '', slug: null, address: '1 Main St', city: null, phone: '555-0100', business_hours: { mon: '9-5' } }])
  })

  it('the sitemap lists published pages only', async () => {
    const db = fakeDb({ pages: [row({ slug: 'team' }), row({ slug: 'draft', is_published: false })] })
    expect(await readPublishedPageEntries(db.query, tenantId)).toEqual([{ slug: 'team', updated_at: '2026-11-16T12:00:00.000Z' }])
    expect(db.log.some(entry => entry.text.includes('is_published=true') && entry.text.includes('SELECT slug, updated_at'))).toBe(true)
  })
})

describe('storing a submission', () => {
  const submission = { name: 'Ana', email: 'ana@example.com', phone: null, message: 'Hi' }
  const form = [{ id: 'f', type: 'contact_form', notifyEmail: 'jobs@example.com' }]

  it('stores it for a published page with a contact form and says where to notify', async () => {
    const db = fakeDb({ pages: [row({ slug: 'contact', title: 'Contact', sections: form })] })
    expect(await storePageSubmission(db.query, tenantId, 'contact', submission, 'fallback@example.com')).toEqual({ pageTitle: 'Contact', notifyEmail: 'jobs@example.com' })
    expect(db.inserted).toHaveLength(1)
    const noAddress = fakeDb({ pages: [row({ slug: 'contact', sections: [{ id: 'f', type: 'contact_form' }] })] })
    expect((await storePageSubmission(noAddress.query, tenantId, 'contact', submission, 'fallback@example.com'))?.notifyEmail).toBe('fallback@example.com')
    expect((await storePageSubmission(noAddress.query, tenantId, 'contact', submission, null))?.notifyEmail).toBeNull()
  })

  it('stores nothing for a missing, unpublished or form-less page', async () => {
    const db = fakeDb({ pages: [row({ slug: 'draft', is_published: false, sections: form }), row({ slug: 'plain', sections: [] })] })
    expect(await storePageSubmission(db.query, tenantId, 'draft', submission, null)).toBeNull()
    expect(await storePageSubmission(db.query, tenantId, 'plain', submission, null)).toBeNull()
    expect(await storePageSubmission(db.query, tenantId, 'nope', submission, null)).toBeNull()
    expect(await storePageSubmission(fakeDb({ ready: false }).query, tenantId, 'plain', submission, null)).toBeNull()
    expect(db.inserted).toHaveLength(0)
  })
})
