import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { resolveSite } from '@/lib/site/resolve-site'

const mocks = vi.hoisted(() => ({ native: vi.fn(), publicPosts: vi.fn(), tags: vi.fn(), archive: vi.fn(), nativePosts: vi.fn(), nativeTags: vi.fn(), nativeArchive: vi.fn(), ownedBlog: vi.fn(), image: vi.fn(), dish: vi.fn(), site: vi.fn() }))
vi.mock('@/lib/blog/native/selected', () => ({ nativeBlogSelected: mocks.native, requireNativeBlogConfiguration: () => {} }))
vi.mock('@/lib/blog/public-queries', () => ({ listPublishedPosts: mocks.publicPosts, listTags: mocks.tags, listArchive: mocks.archive }))
vi.mock('@/lib/blog/native/public-data', () => ({ readNativePublishedPosts: mocks.nativePosts, readNativeBlogTags: mocks.nativeTags, readNativeBlogArchive: mocks.nativeArchive }))
vi.mock('@/lib/data/admin-menus-runtime', () => ({ ownedAdminTransaction: async (_write: boolean, operation: (query: unknown) => Promise<unknown>) => operation(vi.fn()) }))
vi.mock('@/lib/data/public-seo-runtime', () => ({ ownedPlatformBlogSitemap: mocks.ownedBlog }))
vi.mock('@/lib/data/owned-mode', () => ({ ownedModeActive: () => true }))
vi.mock('@/lib/site/discovery-request', () => ({ discoveryRequestSite: mocks.site }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => { throw new Error('Unexpected legacy DB') } }))
vi.mock('@/components/blog/post-list', () => ({ BlogPostList: () => null }))
vi.mock('@/components/delivery-image', () => ({ DeliveryImage: mocks.image }))
vi.mock('@/components/seo/JsonLdScript', () => ({ default: () => null }))
vi.mock('@/lib/menu/dish-pages-runtime', () => ({ loadPublicDish: mocks.dish }))
vi.mock('@/lib/site/runtime', () => ({ loadTenantSite: mocks.site }))

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
  mocks.publicPosts.mockResolvedValue([]); mocks.tags.mockResolvedValue([]); mocks.archive.mockResolvedValue([])
  mocks.nativePosts.mockResolvedValue([]); mocks.nativeTags.mockResolvedValue([]); mocks.nativeArchive.mockResolvedValue([])
  mocks.ownedBlog.mockResolvedValue({ posts: [], tags: [], archive: [] })
  mocks.site.mockResolvedValue(platformSite)
  mocks.image.mockImplementation(({ src, alt, sizes }: { src: string; alt: string; sizes: string }) => createElement('img', { src, alt, sizes }))
})

describe('empty platform blogs stay out of discovery', () => {
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
