import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ site: vi.fn(), blog: vi.fn(), posts: vi.fn() }))
vi.mock('@/lib/site/runtime', () => ({ loadTenantSite: mocks.site }))
vi.mock('@/lib/blog/tenant-blog-gate', () => ({ resolveTenantBlog: mocks.blog }))
vi.mock('@/lib/blog/public-queries', () => ({ listPublishedPosts: mocks.posts }))
vi.mock('@/lib/blog/native/selected', () => ({ nativeBlogSelected: () => true }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => { throw new Error('Unexpected legacy read') } }))
import { GET } from '@/app/(public)/[slug]/blog/rss.xml/route'

const props = { params: Promise.resolve({ slug: 'restaurant' }) }
const request = new Request('https://partner.example/restaurant/blog/rss.xml')
beforeEach(() => {
  vi.clearAllMocks()
  mocks.site.mockResolvedValue({ indexable: true, baseUrl: 'https://partner.example/restaurant' })
  mocks.blog.mockResolvedValue({ tenantId: 'tenant', name: 'Independent Restaurant' })
  mocks.posts.mockResolvedValue([{ slug: 'our-menu', title: 'Our menu', excerpt: 'Fresh ingredients.', published_at: '2026-01-01T00:00:00Z' }])
})
it('uses the tenant canonical brand namespace for channel, post and self links', async () => {
  const response = await GET(request, props)
  expect(response.status).toBe(200)
  const xml = await response.text()
  expect(xml).toContain('https://partner.example/restaurant/blog/our-menu')
  expect(xml).toContain('https://partner.example/restaurant/blog/rss.xml')
  expect(xml).not.toMatch(/xprout|localhost/i)
  expect(response.headers.get('vary')).toBe('Host')
})
it('denies aliases, previews and drafts before reading blog content', async () => {
  mocks.site.mockResolvedValue({ indexable: false })
  const response = await GET(request, props)
  expect(response.status).toBe(404)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(mocks.blog).not.toHaveBeenCalled()
  expect(mocks.posts).not.toHaveBeenCalled()
})
it('preserves the blog entitlement gate on an otherwise public tenant', async () => {
  mocks.blog.mockResolvedValue(null)
  expect((await GET(request, props)).status).toBe(404)
  expect(mocks.posts).not.toHaveBeenCalled()
})
