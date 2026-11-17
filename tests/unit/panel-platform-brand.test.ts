import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => null }))

import { PLATFORM_BRAND_ASSETS } from '@/lib/platform-brand'
import PanelPlatformBrand, { usesPlatformSignature } from '@/components/branding/PanelPlatformBrand'
import SuperadminSidebar from '@/components/admin/SuperadminSidebar'
import AdminSidebar from '@/components/admin/AdminSidebar'
import DashboardShell from '@/components/admin/DashboardShell'

const custom = 'https://custom.example/logo.png'

describe('platform brand in the internal panels', () => {
  it('uses the approved signature only for the default Xprout identity', () => {
    expect(usesPlatformSignature('Xprout', null)).toBe(true)
    expect(usesPlatformSignature(undefined, PLATFORM_BRAND_ASSETS.icon)).toBe(true)
    expect(usesPlatformSignature('Xprout', custom)).toBe(false)
    expect(usesPlatformSignature('Partner Dining', null)).toBe(false)
  })

  it('sizes each placement and keeps the approved aspect', () => {
    const header = renderToStaticMarkup(createElement(PanelPlatformBrand, { tone: 'ivory', placement: 'header' }))
    expect(header).toContain(PLATFORM_BRAND_ASSETS.horizontalIvory)
    expect(header).toContain('w-[177px]')
    expect(header).not.toContain('sm:w-[195px]')
    const bar = renderToStaticMarkup(createElement(PanelPlatformBrand, { tone: 'forest', placement: 'bar' }))
    expect(bar).toContain(PLATFORM_BRAND_ASSETS.horizontalForest)
    expect(bar).toContain('w-[126px]')
    expect(bar).toContain('aspect-ratio:901.8794539094855 / 314.0554789427838')
  })

  it('keeps a configured white-label icon and name instead of the signature', () => {
    const markup = renderToStaticMarkup(createElement(PanelPlatformBrand, { appName: 'Partner Dining', logoUrl: custom, tone: 'ivory', placement: 'credit' }))
    expect(markup).not.toContain(PLATFORM_BRAND_ASSETS.horizontalIvory)
    expect(markup).toContain('Partner Dining')
    expect(markup).toContain('custom.example')
  })

  it('leads the super admin rail with the ivory signature', () => {
    const markup = renderToStaticMarkup(createElement(SuperadminSidebar, { appName: 'Xprout', logoUrl: null }))
    expect(markup).toContain(PLATFORM_BRAND_ASSETS.horizontalIvory)
    expect(markup).toContain('Super Admin Console')
  })

  it('lets the restaurant lead its panel and signs the footer with Xprout', () => {
    const markup = renderToStaticMarkup(createElement(AdminSidebar, { tenantName: 'Aurora', role: 'store-admin', appName: 'Xprout', ownedAuth: true }))
    expect(markup).toContain('Aurora')
    expect(markup).toContain('Powered by')
    expect(markup.indexOf('Aurora')).toBeLessThan(markup.indexOf(PLATFORM_BRAND_ASSETS.horizontalIvory))
    expect(markup).not.toContain(PLATFORM_BRAND_ASSETS.icon)
  })

  it('shows the platform brand in the phone bar only for the platform console', () => {
    const shell = (platformBrandInBar: boolean) => renderToStaticMarkup(createElement(DashboardShell, {
      appName: 'Xprout', contextName: 'Aurora', sidebar: null, platformBrandInBar, children: null,
    }))
    expect(shell(true)).toContain(PLATFORM_BRAND_ASSETS.horizontalForest)
    expect(shell(false)).not.toContain(PLATFORM_BRAND_ASSETS.horizontalForest)
    expect(shell(false)).toContain('Aurora')
  })
})
