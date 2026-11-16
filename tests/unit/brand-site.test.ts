import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveSite, type ResolvedSite } from '@/lib/site/resolve-site'

const mocks = vi.hoisted(() => ({ site: vi.fn(), tenant: vi.fn(), pages: vi.fn() }))
vi.mock('@/lib/site/request-runtime', () => ({ requestSite: mocks.site }))
vi.mock('@/lib/menu/public-menu-data', () => ({ getTenantBySlug: mocks.tenant }))
vi.mock('@/lib/data/tenant-pages-runtime', () => ({ loadPublicPages: mocks.pages }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('not found') } }))
import BrandSitePage, { generateMetadata } from '@/app/brand-site/[host]/[[...segments]]/page'

const brand = { id: 'partner', name: 'Partner Dining', primary_host: 'partner.example', extra_hosts: [], default_lang: 'en', icon: '/partner/icon.svg' }
const props = () => ({ params: Promise.resolve({ host: 'partner.example', segments: [] }) })
beforeEach(() => {
  const site: ResolvedSite = resolveSite({ host: 'partner.example', pathname: '/', tenant: null, brand })
  mocks.site.mockResolvedValue({ ...site, pathname: '/', rewrite: '/brand-site/partner.example', privatePage: false })
  mocks.tenant.mockResolvedValue(null)
})

describe('partner and apex output boundary', () => {
  it('renders the partner home and metadata without Xprout branding', async () => {
    const body = renderToStaticMarkup(createElement('div', null, await BrandSitePage(props())))
    const metadata = await generateMetadata(props())
    expect(body).toContain('Partner Dining')
    expect(body).not.toMatch(/xprout/iu)
    expect(metadata.alternates).toEqual({ canonical: 'https://partner.example' })
    expect(JSON.stringify(metadata)).not.toMatch(/xprout/iu)
  })
  it('rejects direct rendering outside the middleware host/rewrite contract', async () => {
    mocks.site.mockResolvedValue({ brand, rewrite: null })
    await expect(BrandSitePage(props())).rejects.toThrow('not found')
  })
})
