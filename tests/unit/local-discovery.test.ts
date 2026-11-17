import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Product } from '@/types/database'
import { branchDescription, branchDirectionsUrl, branchTitle, dishJsonLd, dishPath, dishSlug, isIndexableDish } from '@/lib/menu/dish-pages'
import { localNavigationLinks, readLocalNavigation } from '@/lib/menu/local-navigation'
import { localPageTemplate } from '@/lib/pages/local-templates'
import { parseSectionsForWrite } from '@/lib/pages/sections'

const mocks = vi.hoisted(() => ({ base: vi.fn(), prices: vi.fn() }))
vi.mock('@/lib/menu/public-menu-data', () => ({ getPublicMenuBase: mocks.base, withMenuPrices: mocks.prices }))
import { loadPublicDish } from '@/lib/menu/dish-pages-runtime'

const product = {
  id: '11111111-1111-4111-8111-111111111111', name: 'Crème brûlée', description: 'Vanilla custard, caramel crust.',
  image_url: 'https://cdn.example.com/dish.webp', is_available: true, price: 12, tags: ['vegetarian'],
} as Product
const menu = { id: 'menu', slug: 'dinner', name: 'Dinner', is_default: true, is_private: false, is_active: true }
const base = { kind: 'menu', tenant: { id: 'tenant', slug: 'pizza' }, menu, location: null, products: [product], optionGroupsByProductId: {} }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.base.mockResolvedValue(base)
  mocks.prices.mockImplementation(value => value)
})

describe('stable dish discovery rules', () => {
  it('creates deterministic accent-safe paths and distinguishes duplicate names', () => {
    expect(dishSlug(product)).toBe('creme-brulee-111111111111')
    expect(dishPath('dinner', product)).toBe('/dinner/creme-brulee-111111111111')
    expect(dishSlug({ ...product, id: '11111111-1111-4111-8111-222222222222' })).not.toBe(dishSlug(product))
    expect(dishSlug(product)).toBe(dishSlug({ ...product }))
  })
  it('keeps short factual descriptions eligible without an arbitrary word count', () => {
    expect(isIndexableDish(product)).toBe(true)
    expect(isIndexableDish({ ...product, description: 'Vanilla custard.' })).toBe(true)
  })
  it.each([
    { description: null }, { description: '  ' }, { description: 'Crème brûlée' },
    { image_url: null }, { image_url: 'javascript:alert(1)' }, { is_available: false },
    { price: -1 }, { price: Number.NaN },
  ])('excludes incomplete/unavailable products %j', changed => {
    expect(isIndexableDish({ ...product, ...changed })).toBe(false)
  })
  it('uses the visible from-price semantics in MenuItem structured data', () => {
    const ld = dishJsonLd(product, 'https://pizza.com/dinner/dish', 'https://pizza.com/dinner', 'USD', product.image_url!, { amount: 10, from: true })
    expect(ld).toMatchObject({ '@type': 'MenuItem', name: product.name, offers: { '@type': 'AggregateOffer', lowPrice: '10.00', priceCurrency: 'USD' } })
    expect(ld).not.toHaveProperty('aggregateRating')
  })
})

describe('public dish loader privacy and routing', () => {
  it('returns only an exact eligible public-menu product and the menu price', async () => {
    const found = await loadPublicDish('pizza', 'dinner', dishSlug(product))
    expect(found?.product.id).toBe(product.id)
    expect(found?.price).toEqual({ amount: 12, from: false })
  })
  it('rejects private menus before examining or pricing their products', async () => {
    mocks.base.mockResolvedValue({ ...base, menu: { ...menu, is_private: true }, privateAccess: true })
    expect(await loadPublicDish('pizza', 'dinner', dishSlug(product))).toBeNull()
    expect(mocks.prices).not.toHaveBeenCalled()
  })
  it('does not return inactive menus, unknown slugs, branch aliases or ambiguous product slugs', async () => {
    expect(await loadPublicDish('pizza', 'dinner', 'unknown')).toBeNull()
    mocks.base.mockResolvedValue({ ...base, menu: { ...menu, is_active: false } })
    expect(await loadPublicDish('pizza', 'dinner', dishSlug(product))).toBeNull()
    mocks.base.mockResolvedValue({ ...base, location: { name: 'Downtown' } })
    expect(await loadPublicDish('pizza', 'dinner', dishSlug(product))).toBeNull()
    mocks.base.mockResolvedValue({ ...base, products: [product, product] })
    expect(await loadPublicDish('pizza', 'dinner', dishSlug(product))).toBeNull()
  })
})

describe('bounded crawlable local navigation', () => {
  const privateMenu = { id: 'private', slug: 'members', name: 'Members', is_default: false, is_private: true }
  it('links real menus and branches on the tenant canonical host without advertising private menus', () => {
    const links = localNavigationLinks([menu, privateMenu], [
      { name: 'Downtown', slug: 'downtown', menu_id: menu.id },
      { name: 'Private lounge', slug: 'lounge', menu_id: privateMenu.id },
    ], 'https://pizza.com')
    expect(links).toEqual([
      { title: 'Dinner', href: 'https://pizza.com/dinner', kind: 'menu' },
      { title: 'Downtown', href: 'https://pizza.com/downtown', kind: 'branch' },
    ])
  })
  it('does not offer a menu that has no available dish', () => {
    const empty = { id: 'drinks', slug: 'drinks', name: 'Drinks', is_default: false, is_private: false, has_products: false }
    const links = localNavigationLinks([{ ...menu, has_products: true }, empty], [], 'https://pizza.com')
    expect(links.map(link => link.title)).toEqual(['Dinner'])
  })
  it('scopes every navigation query to one tenant and bounds the read', async () => {
    const query = vi.fn(async (sql: string, _values?: unknown[]) => ({ rows: sql.includes('public.menus') ? [menu] : [] }))
    await readLocalNavigation(query, 'tenant-id')
    for (const [sql, values] of query.mock.calls) {
      expect(sql).toContain('tenant_id=$1')
      expect(sql).toContain('LIMIT 100')
      expect(values).toEqual(['tenant-id'])
    }
  })
})

describe('local content uses stored facts', () => {
  it('builds branch metadata from the actual location without parking claims', () => {
    const location = { name: 'Downtown', city: 'New York', address: '10 Main Street' }
    expect(branchTitle('Pizza', location)).toBe('Pizza – Downtown, New York: menu, hours and directions')
    expect(branchDescription('Pizza', location)).toContain('10 Main Street')
    expect(branchDescription('Pizza', location)).not.toContain('parking')
    expect(branchDirectionsUrl({ latitude: 0, longitude: 0 })).toContain('destination=0%2C0')
    expect(branchDirectionsUrl({})).toBeNull()
  })
  it.each(['locations', 'catering', 'private-events', 'faq'] as const)('reuses valid existing sections for %s', kind => {
    const template = localPageTemplate(kind, { restaurantName: 'Pizza', description: 'Merchant-provided service details.', questions: [{ question: 'Do you cater?', answer: 'Contact our team.' }] })
    expect(parseSectionsForWrite(template.sections).ok).toBe(true)
    expect(template.sections.every(section => ['text_image', 'contact_form', 'locations', 'faq'].includes(section.type))).toBe(true)
  })
})
