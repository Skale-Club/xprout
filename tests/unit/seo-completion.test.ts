import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { resolveSite } from '@/lib/site/resolve-site'

const mocks = vi.hoisted(() => ({ owned: vi.fn(), native: vi.fn(), publicPosts: vi.fn(), tags: vi.fn(), archive: vi.fn(), nativePosts: vi.fn(), nativeTags: vi.fn(), nativeArchive: vi.fn(), ownedBlog: vi.fn(), image: vi.fn(), dish: vi.fn(), site: vi.fn() }))
vi.mock('@/lib/blog/native/selected', () => ({ nativeBlogSelected: mocks.native, requireNativeBlogConfiguration: () => {} }))
vi.mock('@/lib/blog/public-queries', () => ({ listPublishedPosts: mocks.publicPosts, listTags: mocks.tags, listArchive: mocks.archive }))
vi.mock('@/lib/blog/native/public-data', () => ({ readNativePublishedPosts: mocks.nativePosts, readNativeBlogTags: mocks.nativeTags, readNativeBlogArchive: mocks.nativeArchive }))
vi.mock('@/lib/data/admin-menus-runtime', () => ({ ownedAdminTransaction: async (_write: boolean, operation: (query: unknown) => Promise<unknown>) => operation(vi.fn()) }))
vi.mock('@/lib/data/public-seo-runtime', () => ({ ownedPlatformBlogSitemap: mocks.ownedBlog }))
vi.mock('@/lib/data/owned-mode', () => ({ ownedModeActive: mocks.owned }))
vi.mock('@/lib/site/discovery-request', () => ({ discoveryRequestSite: mocks.site }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => { throw new Error('Unexpected legacy DB') } }))
vi.mock('@/components/blog/post-list', () => ({ BlogPostList: () => null }))
vi.mock('@/components/pages/TenantSiteFooter', () => ({ default: () => null }))
vi.mock('@/components/delivery-image', () => ({ DeliveryImage: mocks.image }))
vi.mock('@/components/seo/JsonLdScript', () => ({ default: () => null }))
vi.mock('@/lib/menu/dish-pages-runtime', () => ({ loadPublicDish: mocks.dish }))
vi.mock('@/lib/site/runtime', () => ({ loadTenantSite: mocks.site }))
// The dish page is drawn inside the menu: the menu's data and MenuPage itself are stand-ins here.
const menuMocks = vi.hoisted(() => ({ menuData: vi.fn(), menuPage: vi.fn() }))
vi.mock('@/lib/menu/public-menu-data', () => ({ loadPublicMenuData: menuMocks.menuData, withMenuPrices: (data: unknown) => data }))
vi.mock('@/lib/menu/local-navigation', () => ({ loadLocalNavigation: async () => [] }))
vi.mock('@/lib/data/tenant-pages-runtime', () => ({ loadPublicPageNav: async () => [] }))
vi.mock('@/components/menu/MenuPage', () => ({ default: menuMocks.menuPage }))

import { generateMetadata as blogMetadata } from '@/app/(marketing)/blog/page'
import { nativePlatformSitemap } from '@/lib/blog/native/sitemap'
import { GET as platformSitemap } from '@/app/sitemaps/platform.xml/route'
import DishPage, { generateMetadata as dishMetadata } from '@/app/(public)/[slug]/[menuSlug]/[dishSlug]/page'

const host = 'pizza.example.org'
const tenant = { slug: 'pizza', name: 'Pizza', is_active: true, is_demo: false, published_at: '2026-01-01T00:00:00Z', custom_domain: host, custom_domain_verified: true }
const dishSite = resolveSite({ host, pathname: '/pizza/dinner/soup', tenant, subdomainBase: null })
const platformSite = resolveSite({ host: 'xprout.app', pathname: '/', tenant: null, platformOrigin: 'https://xprout.app' })
const params = () => Promise.resolve({ slug: 'pizza', menuSlug: 'dinner', dishSlug: 'soup' })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.native.mockReturnValue(true)
  mocks.owned.mockReturnValue(true)
  mocks.publicPosts.mockResolvedValue([]); mocks.tags.mockResolvedValue([]); mocks.archive.mockResolvedValue([])
  mocks.nativePosts.mockResolvedValue([]); mocks.nativeTags.mockResolvedValue([]); mocks.nativeArchive.mockResolvedValue([])
  mocks.ownedBlog.mockResolvedValue({ posts: [], tags: [], archive: [] })
  mocks.site.mockResolvedValue(platformSite)
  mocks.image.mockImplementation(({ src, alt, sizes }: { src: string; alt: string; sizes: string }) => createElement('img', { src, alt, sizes }))
  menuMocks.menuData.mockResolvedValue({ kind: 'menu', tenant: { ...tenant, id: 'tenant' }, menu: { id: 'menu', name: 'Dinner', language: 'en' }, categories: [], products: [],
    optionGroupsByProductId: {}, productIngredientsByProductId: {}, productMediaByProductId: {}, productArModelByProductId: {}, deliveryZones: [],
    capabilities: { guestOrdering: true }, footerBrand: 'Xprout' })
  menuMocks.menuPage.mockImplementation(({ dishPage }: { dishPage: unknown }) => createElement('div', { 'data-menu-page': '' }, dishPage as never))
})

describe('empty platform blogs stay out of discovery', () => {
  it('serves the legacy partner apex fallback sitemap without opening an owned database', async () => {
    mocks.owned.mockReturnValue(false)
    mocks.site.mockResolvedValue({ ...platformSite, origin: 'https://partner.example.org', kind: 'brand-apex-tenant',
      brand: { ...platformSite.brand, id: 'partner' }, tenant: { id: 'company', slug: 'company' } })
    const response = await platformSitemap(new Request('https://partner.example.org/sitemaps/platform.xml'))
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('<loc>https://partner.example.org</loc>')
    expect(mocks.ownedBlog).not.toHaveBeenCalled()
  })
  it('noindexes the empty blog and preserves parent authority when live posts exist', async () => {
    expect((await blogMetadata()).robots).toEqual({ index: false, follow: false })
    mocks.publicPosts.mockResolvedValue([{ slug: 'published', published_at: '2026-01-01T00:00:00Z' }])
    expect((await blogMetadata()).robots).toBeUndefined()
  })
  it('omits empty native blog, tags and archives while retaining static marketing pages', async () => {
    const entries = await nativePlatformSitemap()
    expect(entries).toHaveLength(2)
    expect(entries.some(entry => entry.url.includes('/blog'))).toBe(false)
    expect(mocks.nativeTags).not.toHaveBeenCalled()
    expect(mocks.nativeArchive).not.toHaveBeenCalled()
  })
  it('restores only the real native blog posts and archive URLs when content exists', async () => {
    mocks.nativePosts.mockResolvedValue([{ slug: 'published', published_at: '2026-01-01T00:00:00Z' }])
    mocks.nativeTags.mockResolvedValue([{ slug: 'food' }]); mocks.nativeArchive.mockResolvedValue([{ year: 2026, month: 1 }])
    const urls = (await nativePlatformSitemap()).map(entry => entry.url)
    expect(urls.some(url => url.endsWith('/blog/published'))).toBe(true)
    expect(urls.some(url => url.endsWith('/blog/archive/2026/01'))).toBe(true)
  })
  it('also omits owned blog listings when the only scheduled post is still in the future', async () => {
    mocks.native.mockReturnValue(false)
    mocks.ownedBlog.mockResolvedValue({ posts: [{ slug: 'future', published_at: '2999-01-01T00:00:00Z' }], tags: ['future'], archive: [{ year: 2999, month: 1 }] })
    const response = await platformSitemap(new Request('https://xprout.app/sitemaps/platform.xml'))
    expect(response.status).toBe(200)
    expect(await response.text()).not.toContain('/blog')
  })
})

describe('responsive dish images keep separate UI and metadata URL contracts', () => {
  it('passes a relative local derivative to DeliveryImage while exposing an absolute social image', async () => {
    mocks.site.mockResolvedValue(dishSite)
    mocks.dish.mockResolvedValue({ tenant: { ...tenant, tenant_settings: { currency: 'USD', primary_color: '#283f32', accent_color: '#18181b' } },
      menu: { name: 'Dinner' }, product: { name: 'Soup', description: 'Roasted tomatoes.', image_url: '/brands/aurora-kitchen-bar/artisan-burger.webp', price: 12.5, tags: [] }, price: { amount: 12.5, from: false } })
    renderToStaticMarkup(await DishPage({ params: params() }))
    expect(mocks.image).toHaveBeenCalledWith(expect.objectContaining({ src: '/brands/aurora-kitchen-bar/artisan-burger.webp', sizes: expect.stringContaining('450px') }), undefined)
    const metadata = await dishMetadata({ params: params() })
    expect(metadata.openGraph).toMatchObject({ images: [{ url: `https://${host}/brands/aurora-kitchen-bar/artisan-burger.webp`, alt: 'Soup' }] })
  })
})

describe('dish page navigation', () => {
  it('is drawn inside the menu (its header, footer and order) and leads back only through the breadcrumb', async () => {
    mocks.site.mockResolvedValue(dishSite)
    mocks.dish.mockResolvedValue({ tenant: { ...tenant, tenant_settings: { currency: 'USD' } },
      menu: { name: 'Dinner', language: 'en' }, product: { id: 'soup', name: 'Soup', description: 'Roasted tomatoes.', image_url: '/brands/aurora-kitchen-bar/artisan-burger.webp', price: 12.5, tags: ['gluten-free'] }, price: { amount: 12.5, from: false } })
    const html = renderToStaticMarkup(await DishPage({ params: params() }))
    const props = menuMocks.menuPage.mock.calls[0][0]
    expect(props).toMatchObject({ initialLanguage: 'en', capabilities: { guestOrdering: true }, canonicalBaseUrl: dishSite.baseUrl })
    expect(props.dishPage).toBeTruthy()
    const menuHref = `href="${dishSite.baseUrl}/dinner"`
    const breadcrumb = html.match(/<nav aria-label="Breadcrumb"[\s\S]*?<\/nav>/)?.[0] ?? ''
    const article = html.match(/<article[\s\S]*?<\/article>/)?.[0] ?? ''
    expect(html).toMatch(/<div data-menu-page="">[\s\S]*<h1/)
    expect(breadcrumb).toContain(menuHref)
    expect(article).not.toBe('')
    expect(article).not.toContain(menuHref)
    expect(article).not.toMatch(/>Dinner</)
  })
  it('shows the category, sizes, ingredients and other dishes linking to their own pages', async () => {
    mocks.site.mockResolvedValue(dishSite)
    mocks.dish.mockResolvedValue({ tenant: { ...tenant, tenant_settings: { currency: 'USD' } },
      menu: { name: 'Dinner', language: 'en' }, product: { id: 'soup', name: 'Soup', description: 'Roasted tomatoes.', image_url: '/brands/aurora-kitchen-bar/artisan-burger.webp', price: 12.5, original_price: null, tags: [] },
      price: { amount: 9, from: true }, category: 'Starters', ingredients: ['Tomato', 'Basil'],
      sizes: [{ id: 'size', name: 'Size', type: 'single', options: [{ id: 's', name: 'Cup', base_price: 9, price_modifier: 0 }, { id: 'l', name: 'Bowl', base_price: 14, price_modifier: 0 }] }],
      related: [{ id: 'r', name: 'Bread', slug: 'bread-111111111111', image_url: '/brands/aurora-kitchen-bar/artisan-burger.webp', price: { amount: 4, from: false } }] })
    const html = renderToStaticMarkup(await DishPage({ params: params() }))
    expect(html).toContain('Starters')
    expect(html).toMatch(/Cup<\/span><span[^>]*>\$9\.00/)
    expect(html).toContain('Tomato, Basil')
    expect(html).toContain(`href="${dishSite.baseUrl}/dinner/bread-111111111111"`)
  })
  it('reads in the language asked for when the menu offers it, else the site language', async () => {
    mocks.site.mockResolvedValue(dishSite)
    mocks.dish.mockResolvedValue({ tenant: { ...tenant, tenant_settings: { currency: 'USD' } },
      menu: { name: 'Dinner', language: 'en', supported_languages: ['en', 'pt'], translations: { pt: { name: 'Jantar' } } },
      product: { id: 'soup', name: 'Soup', description: 'Roasted tomatoes.', image_url: '/brands/aurora-kitchen-bar/artisan-burger.webp', price: 12.5, tags: [] }, price: { amount: 12.5, from: false } })
    const html = renderToStaticMarkup(await DishPage({ params: params(), searchParams: Promise.resolve({ lang: 'pt' }) }))
    expect(mocks.dish).toHaveBeenCalledWith('pizza', 'dinner', 'soup', 'pt')
    expect(menuMocks.menuPage.mock.calls[0][0]).toMatchObject({ initialLanguage: 'pt' })
    expect(html).toContain('>Jantar</a>')
    menuMocks.menuPage.mockClear()
    renderToStaticMarkup(await DishPage({ params: params(), searchParams: Promise.resolve({ lang: 'ja' }) }))
    expect(menuMocks.menuPage.mock.calls[0][0]).toMatchObject({ initialLanguage: 'en' })
  })
})
