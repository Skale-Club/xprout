import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublicPage } from '@/lib/data/tenant-pages'
import { resolveSite, type ResolveSiteInput } from '@/lib/site/resolve-site'

const mocks = vi.hoisted(() => ({ menu: vi.fn(), site: vi.fn(), blogTenant: vi.fn(), posts: vi.fn() }))
vi.mock('@/lib/menu/public-menu-data', () => ({
  getPublicMenuBase: mocks.menu, getTenantBySlug: vi.fn(), loadPublicMenuData: vi.fn(), withMenuPrices: vi.fn(),
}))
vi.mock('@/lib/site/runtime', () => ({ loadTenantSite: mocks.site }))
vi.mock('@/lib/data/tenant-pages-runtime', () => ({ loadPublicPageNav: vi.fn(), loadPublicPages: vi.fn() }))
vi.mock('@/lib/blog/native/selected', () => ({ nativeBlogSelected: () => true }))
vi.mock('@/lib/blog/native/public-runtime', () => ({ nativeBlogTenant: mocks.blogTenant, nativePublishedPosts: mocks.posts }))
vi.mock('@/lib/tenant-plan', () => ({ getTenantPlan: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => { throw new Error('Unexpected legacy database') } }))
vi.mock('@/components/menu/MenuPage', () => ({ default: () => null }))
vi.mock('@/components/menu/BranchPicker', () => ({ default: () => null }))
vi.mock('@/components/menu/ScanRecorder', () => ({ default: () => null }))
vi.mock('@/components/menu/PrivateMenuWrapper', () => ({ default: () => null }))
vi.mock('@/components/pages/TenantPageView', () => ({ default: () => null }))
vi.mock('@/components/seo/JsonLdScript', () => ({ default: () => null }))
vi.mock('@/components/delivery-image', () => ({ DeliveryImage: () => null }))

import { generateMetadata as homeMetadata } from '@/app/(public)/[slug]/page'
import { generateMetadata as menuMetadata } from '@/app/(public)/[slug]/[menuSlug]/page'
import { generateMetadata as blogMetadata } from '@/app/(public)/[slug]/blog/page'
import { pageMetadata } from '@/lib/pages/public-page'

const tenant = {
  slug: 'pizza', name: 'Pizza House', is_active: true, is_demo: false,
  published_at: '2026-01-01T00:00:00Z', custom_domain: 'pizza.com', custom_domain_verified: true,
  tenant_settings: { language: 'pt-BR', seo_noindex: false, seo_title: 'Pizza House', tagline: 'Wood-fired pizza' },
}
const now = Date.parse('2026-11-16T12:00:00Z')
const site = (input: Partial<ResolveSiteInput> = {}) => resolveSite({
  host: 'pizza.com', pathname: '/pizza', tenant, platformOrigin: 'https://xprout.app', subdomainBase: null, now, ...input,
})
const homeProps = () => ({ params: Promise.resolve({ slug: 'pizza' }), searchParams: Promise.resolve({}) })
const menuProps = () => ({ params: Promise.resolve({ slug: 'pizza', menuSlug: 'drinks' }), searchParams: Promise.resolve({}) })
const page: PublicPage = { id: 'page', slug: 'about', title: 'Our story', description: 'Meet our team', updated_at: '2026-01-01T00:00:00Z', sections: [], locations: [] }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.menu.mockResolvedValue({ kind: 'menu', tenant, menu: { name: 'Dinner', is_private: false }, location: null })
  mocks.site.mockImplementation(async (_slug: string, pathname: string, options: { privatePage?: boolean } = {}) => site({ pathname, ...options }))
  mocks.blogTenant.mockResolvedValue({ tenantId: 'tenant', name: tenant.name })
  mocks.posts.mockResolvedValue([])
})

describe('tenant route metadata uses resolved site identity', () => {
  it('uses the tenant custom origin and locale for home metadata', async () => {
    const metadata = await homeMetadata(homeProps())
    expect(metadata.alternates).toEqual({ canonical: 'https://pizza.com' })
    expect(metadata.openGraph).toMatchObject({ url: 'https://pizza.com', siteName: 'Pizza House', locale: 'pt_BR' })
    expect(metadata.robots).toEqual({ index: true, follow: true })
    expect(metadata.title).toEqual({ absolute: 'Pizza House' })
  })

  it('keeps the canonical host in metadata while denying a platform alias', async () => {
    mocks.site.mockResolvedValue(site({ host: 'xprout.app' }))
    const metadata = await homeMetadata(homeProps())
    expect(metadata.alternates).toEqual({ canonical: 'https://pizza.com' })
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })

  it('denies the default private menu even when public tenant SEO allows indexing', async () => {
    mocks.menu.mockResolvedValue({ kind: 'menu', tenant, menu: { name: 'Private dinner', is_private: true } })
    const metadata = await homeMetadata(homeProps())
    expect(mocks.site).toHaveBeenCalledWith('pizza', '/pizza', { privatePage: true })
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })

  it('denies a branch using a private menu regardless of guest access state', async () => {
    mocks.menu.mockResolvedValue({ kind: 'menu', tenant, menu: { name: 'Private dinner', is_private: true }, location: { name: 'Downtown' }, privateAccess: true })
    const metadata = await menuMetadata(menuProps())
    expect(mocks.site).toHaveBeenCalledWith('pizza', '/pizza/drinks', { privatePage: true })
    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(metadata.alternates).toEqual({ canonical: 'https://pizza.com/drinks' })
  })

  it('preserves a global tenant noindex decision on a public named menu', async () => {
    mocks.site.mockResolvedValue(site({ pathname: '/pizza/drinks', tenant: { ...tenant, tenant_settings: { ...tenant.tenant_settings, seo_noindex: true } } }))
    const metadata = await menuMetadata(menuProps())
    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(metadata.openGraph).toMatchObject({ url: 'https://pizza.com/drinks', locale: 'pt_BR' })
  })

  it('does not turn missing identity into indexable metadata', async () => {
    mocks.site.mockResolvedValue(null)
    expect((await homeMetadata(homeProps())).robots).toEqual({ index: false, follow: false })
  })

  it('propagates an identity outage instead of publishing a successful fallback', async () => {
    mocks.site.mockRejectedValue(new Error('Site identity unavailable'))
    await expect(homeMetadata(homeProps())).rejects.toThrow('Site identity unavailable')
  })

  it('gives the tenant blog its own canonical and preserves denied indexing', async () => {
    mocks.site.mockResolvedValue(site({ pathname: '/pizza/blog', preview: true }))
    const metadata = await blogMetadata({ params: Promise.resolve({ slug: 'pizza' }) })
    expect(metadata.alternates).toEqual({ canonical: 'https://pizza.com/blog' })
    expect(metadata.openGraph).toMatchObject({ url: 'https://pizza.com/blog', locale: 'pt_BR', siteName: 'Pizza House' })
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })
})

describe('published website page metadata', () => {
  it('uses supplied site identity and keeps page copy and social image', () => {
    const configured = { ...tenant, tenant_settings: { ...tenant.tenant_settings, seo_og_image_url: 'https://cdn.example.com/story.webp' } }
    const metadata = pageMetadata(configured, page, site({ pathname: '/pizza/about', preview: true }))
    expect(metadata.alternates).toEqual({ canonical: 'https://pizza.com/about' })
    expect(metadata.openGraph).toMatchObject({ title: 'Our story | Pizza House', description: 'Meet our team', locale: 'pt_BR', images: [{ url: 'https://cdn.example.com/story.webp', alt: 'Pizza House' }] })
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })

  it('fails closed when the caller explicitly supplies a missing identity', () => {
    expect(pageMetadata(tenant, page, null).robots).toEqual({ index: false, follow: false })
  })

  it('preserves legacy callers that omit the site argument', () => {
    const metadata = pageMetadata(tenant, page)
    expect(metadata.alternates).toEqual({ canonical: 'https://pizza.com/about' })
    expect(metadata.robots).toBeUndefined()
  })
})
