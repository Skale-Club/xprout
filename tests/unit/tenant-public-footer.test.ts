import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import TenantPublicFooter from '@/components/pages/TenantPublicFooter'
import { localNavigationLinks } from '@/lib/menu/local-navigation'

const mocks = vi.hoisted(() => ({ pages: vi.fn(), local: vi.fn(), tenant: vi.fn(), site: vi.fn() }))
vi.mock('@/lib/data/tenant-pages-runtime', () => ({ loadPublicPages: mocks.pages }))
vi.mock('@/lib/menu/public-menu-data', () => ({ getTenantBySlug: mocks.tenant }))
vi.mock('@/lib/site/runtime', () => ({ loadTenantSite: mocks.site }))
vi.mock('@/lib/menu/local-navigation', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/menu/local-navigation')>(), loadLocalNavigation: mocks.local,
}))
import TenantSiteFooter from '@/components/pages/TenantSiteFooter'

const tenant = { id: 'tenant', slug: 'bistro', name: 'Bistro' }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.local.mockResolvedValue([{ title: 'Dinner', href: 'https://bistro.example/dinner' }])
  mocks.pages.mockResolvedValue({ nav: [{ slug: 'about', title: 'About' }], page: null })
})

describe('factual shared public footer', () => {
  it('renders stored address and callable phone without inventing other facts', () => {
    const html = renderToStaticMarkup(createElement(TenantPublicFooter, { name: 'Bistro',
      settings: { address: '12 Main Street', city: 'Porto', phone: '+351 (22) 123-4567' }, links: [] }))
    expect(html).toContain('12 Main Street, Porto')
    expect(html).toContain('href="tel:+351221234567"')
    expect(html).not.toContain('openingHours')
    expect(html).not.toContain('Restaurant')
  })
  it('keeps companies with missing location fields factual and escapes stored text', () => {
    const html = renderToStaticMarkup(createElement(TenantPublicFooter, { name: 'Company <HQ>', settings: null, links: [] }))
    expect(html).toContain('Company &lt;HQ&gt;')
    expect(html).not.toContain('tel:')
    expect(html).not.toContain('maps')
    expect(html).not.toContain('<nav')
  })
  it('exposes public menus and branches while excluding private menus and their branches', () => {
    const menus = [
      { id: 'public', slug: 'dinner', name: 'Dinner', is_default: true, is_private: false },
      { id: 'private', slug: 'staff-menu', name: 'Staff only', is_default: false, is_private: true },
    ]
    const links = localNavigationLinks(menus, [
      { name: 'Riverside', slug: 'riverside', menu_id: 'public' },
      { name: 'Staff branch', slug: 'staff-branch', menu_id: 'private' },
    ], 'https://bistro.example')
    const html = renderToStaticMarkup(createElement(TenantPublicFooter, { name: 'Bistro', settings: null, links }))
    expect(html).toContain('href="https://bistro.example/dinner"')
    expect(html).toContain('href="https://bistro.example/riverside"')
    expect(html).not.toContain('staff-menu')
    expect(html).not.toContain('staff-branch')
  })
  it('combines canonical public navigation and published pages without another identity read', async () => {
    const output = await TenantSiteFooter({ tenant, settings: null, baseUrl: 'https://bistro.example' })
    const html = renderToStaticMarkup(output)
    expect(html).toContain('href="https://bistro.example/about"')
    expect(html).toContain('href="https://bistro.example/dinner"')
    expect(mocks.tenant).not.toHaveBeenCalled()
    expect(mocks.site).not.toHaveBeenCalled()
    expect(mocks.local).toHaveBeenCalledWith(tenant.id, 'https://bistro.example')
  })
  it('propagates an authoritative pages outage instead of falling back to another database', async () => {
    mocks.pages.mockRejectedValue(new Error('owned database unavailable'))
    await expect(TenantSiteFooter({ tenant, settings: null, baseUrl: 'https://bistro.example' }))
      .rejects.toThrow('owned database unavailable')
    expect(mocks.tenant).not.toHaveBeenCalled()
  })
})
