import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// The modal is client-only and is exercised by the browser check, not SSR.
vi.mock('next/dynamic', () => ({ default: () => () => null }))
import Landing from '@/app/(marketing)/ClientPage'
import Pricing from '@/app/(marketing)/pricing/PricingClient'

describe('marketing content and identity contracts', () => {
  it('renders saved landing copy, actions and sections through the new layout', () => {
    const html = renderToStaticMarkup(createElement(Landing, {
      appName: 'Configured identity', logoUrl: '/configured-logo.png',
      platformLanding: {
        hero: { heading: 'Saved hero title', heading_highlight: 'Saved highlight', subheading: 'Saved lead', cta_primary: 'Saved primary action', cta_secondary: 'Saved secondary action', bg_type: 'color', bg_color: '#101010' },
        how_it_works: { title: 'Saved process', steps: [{ title: 'Saved step', desc: 'Saved step body', icon: 'QrCode' }] },
        features: { title: 'Saved capabilities', items: [{ title: 'Saved feature', desc: 'Saved feature body', icon: 'Globe' }] },
        cta: { heading: 'Saved invitation', text: 'Saved invitation text', button: 'Saved closing action' },
        footer: { copyright: 'Configured copyright' },
      },
    }))
    for (const copy of ['Saved hero title', 'Saved highlight', 'Saved primary action', 'Saved secondary action', 'Saved process', 'Saved step body', 'Saved capabilities', 'Saved feature body', 'Saved closing action', 'Configured copyright']) expect(html).toContain(copy)
    expect(/(?:%2F|\/)configured-logo\.png/.test(html)).toBe(true)
    expect(html).toContain('background-color:#101010')
    expect(html).toContain('color:#F3EFE5')
  })

  it('preserves explicit identity on pricing and keeps project/monthly costs distinct', () => {
    const html = renderToStaticMarkup(createElement(Pricing, { appName: 'Configured identity', logoUrl: '/configured-logo.png', footerData: { copyright: 'Configured copyright' } }))
    expect(html).toContain('Configured identity')
    expect(/(?:%2F|\/)configured-logo\.png/.test(html)).toBe(true)
    expect(html).toContain('Configured copyright')
    expect(html).toContain('One-time setup from')
    expect(html).toContain('$290')
    expect(html).toContain('$99')
    expect(html).toContain('Compare everything included')
    expect(html).toContain('1%')
  })
})
