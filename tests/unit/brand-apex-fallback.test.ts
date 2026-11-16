import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { resolveSite, type SiteBrand } from '@/lib/site/resolve-site'
import { renderOrderEmail, type OrderEmailData } from '@/lib/orders/order-emails'
import { sendContactEmail } from '@/lib/pages/contact-form'

const mocks = vi.hoisted(() => ({ site: vi.fn(), tenant: vi.fn(), pages: vi.fn(), codedPage: vi.fn(), codedMetadata: vi.fn(), cms: vi.fn() }))
vi.mock('@/lib/site/request-runtime', () => ({ requestSite: mocks.site }))
vi.mock('@/lib/menu/public-menu-data', () => ({ getTenantBySlug: mocks.tenant }))
vi.mock('@/lib/data/tenant-pages-runtime', () => ({ loadPublicPages: mocks.pages }))
vi.mock('@/app/(marketing)/page', () => ({ default: mocks.codedPage, generateMetadata: mocks.codedMetadata }))
vi.mock('@/app/(marketing)/layout', () => ({ default: async ({ children }: { children: unknown }) => children }))
vi.mock('@/components/pages/TenantPageView', () => ({ default: mocks.cms }))
vi.mock('@/components/seo/JsonLdScript', () => ({ default: () => null }))
vi.mock('@/components/tracking/PlatformTagManager', () => ({ PlatformTagManager: () => null }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('not found') } }))
import BrandSitePage, { generateMetadata } from '@/app/brand-site/[host]/[[...segments]]/page'

const defaultId = '00000000-0000-4000-8000-000000000001'
const defaultBrand: SiteBrand = { id: defaultId, name: 'Xprout', primary_host: 'xprout.app', extra_hosts: [], default_lang: 'en', apex_tenant_id: 'company', apex_home_slug: 'home' }
const partner: SiteBrand = { ...defaultBrand, id: 'partner', name: 'Independent Dining', primary_host: 'partner.example.org' }
const company = { id: 'company', name: 'Company', slug: 'company', is_active: true, is_demo: false, published_at: '2026-01-01T00:00:00Z', tenant_settings: { language: 'en', about: 'Merchant-provided company description.' } }
const props = (brand = defaultBrand, segments: string[] = []) => ({ params: Promise.resolve({ host: brand.primary_host, segments }) })
function context(brand = defaultBrand) {
  return { ...resolveSite({ host: brand.primary_host, pathname: '/', tenant: { ...company, brand_id: brand.id }, brand }),
    pathname: '/', rewrite: `/brand-site/${brand.primary_host}`, privatePage: false }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.site.mockResolvedValue(context())
  mocks.tenant.mockResolvedValue(company)
  mocks.pages.mockResolvedValue({ page: null, nav: [] })
  mocks.codedPage.mockResolvedValue(createElement('main', null, 'Existing coded marketing'))
  mocks.codedMetadata.mockResolvedValue({ title: { absolute: 'Existing marketing title' }, description: 'Existing marketing description', openGraph: { title: 'Existing marketing title' } })
  mocks.cms.mockImplementation(({ page }: { page: { title: string } }) => createElement('main', null, page.title))
})

describe('optional apex CMS home fallback', () => {
  it('retains the coded Xprout home when the configured CMS home does not exist', async () => {
    expect(renderToStaticMarkup(await BrandSitePage(props()))).toContain('Existing coded marketing')
    expect(mocks.pages).toHaveBeenCalledWith(company, 'home')
    expect(mocks.codedPage).toHaveBeenCalledOnce()
    expect(mocks.cms).not.toHaveBeenCalled()
    const metadata = await generateMetadata(props())
    expect(metadata).toMatchObject({ title: { absolute: 'Existing marketing title' }, description: 'Existing marketing description', alternates: { canonical: 'https://xprout.app' } })
  })
  it('keeps request noindex authority even when coded fallback metadata is reused', async () => {
    mocks.site.mockResolvedValue({ ...context(), indexable: false, reason: 'preview' })
    expect((await generateMetadata(props())).robots).toEqual({ index: false, follow: false })
  })
  it('prefers an actual configured CMS home over the fallback', async () => {
    mocks.pages.mockResolvedValue({ page: { title: 'Our company home', description: 'Actual saved page' }, nav: [] })
    expect(renderToStaticMarkup(await BrandSitePage(props()))).toContain('Our company home')
    expect(mocks.codedPage).not.toHaveBeenCalled()
    expect((await generateMetadata(props())).title).toEqual({ absolute: 'Our company home | Xprout' })
  })
  it('uses a generic partner home and public navigation without platform claims', async () => {
    mocks.site.mockResolvedValue(context(partner))
    mocks.pages.mockResolvedValue({ page: null, nav: [{ slug: 'about', title: 'About us' }] })
    const html = renderToStaticMarkup(await BrandSitePage(props(partner)))
    expect(html).toContain(partner.name)
    expect(html).toContain('https://partner.example.org/about')
    expect(html).not.toMatch(/Xprout|direct ordering|Digital menus/i)
    expect(mocks.codedPage).not.toHaveBeenCalled()
    expect(JSON.stringify(await generateMetadata(props(partner)))).not.toMatch(/xprout/i)
  })
  it.each([defaultBrand, partner])('keeps explicitly missing nonhome pages as 404 for $name', async brand => {
    mocks.site.mockResolvedValue(context(brand))
    await expect(BrandSitePage(props(brand, ['missing-page']))).rejects.toThrow('not found')
    expect(mocks.codedPage).not.toHaveBeenCalled()
  })
  it('does not hide database errors behind an apparently successful fallback', async () => {
    mocks.pages.mockRejectedValue(new Error('CMS unavailable'))
    await expect(BrandSitePage(props())).rejects.toThrow('CMS unavailable')
    expect(mocks.codedPage).not.toHaveBeenCalled()
  })
})

describe('partner transactional display stays merchant-owned', () => {
  it('renders customer order subject, HTML and text using the restaurant identity', () => {
    const data: OrderEmailData = { orderId: '11111111-1111-4111-8111-111111111111', email: 'guest@example.org', lang: 'en', orderType: 'pickup', scheduledFor: null,
      timeZone: null, etaMinutes: null, currency: 'USD', subtotal: 12, discountCents: 0, promoCode: null, taxCents: 0, deliveryFeeCents: 0, tipCents: 0,
      total: 12, items: [{ name: 'Soup', quantity: 1, unitPrice: 12, details: [], notes: null }], deliveryAddress: null,
      restaurant: { name: 'Independent Restaurant', logoUrl: null, primaryColor: '#283f32', address: '10 Example Street', phone: '555' } }
    for (const kind of ['received', 'ready'] as const) {
      const rendered = renderOrderEmail(kind, data)
      expect(rendered.subject).toContain('Independent Restaurant')
      expect(JSON.stringify(rendered)).not.toMatch(/Xprout|xprout\.app/i)
    }
  })
  it('keeps contact-email display in the merchant name without changing sender authorization', async () => {
    const fakeFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{}', { status: 200 }))
    const sent = await sendContactEmail({ to: 'owner@example.org', restaurantName: 'Independent Company', pageTitle: 'Contact',
      submission: { name: 'Guest', email: 'guest@example.org', phone: null, message: 'Please contact me.' } },
    { env: { NODE_ENV: 'production', RESEND_API_KEY: 'fixture-only', ORDER_EMAIL_FROM: 'authorized@sender.example.org' }, fetchImpl: fakeFetch })
    expect(sent).toBe(true)
    const payload = JSON.parse(String(fakeFetch.mock.calls[0][1]?.body))
    expect(payload.from).toBe('Independent Company <authorized@sender.example.org>')
    expect(JSON.stringify(payload)).not.toMatch(/Xprout|xprout\.app/i)
  })
})
