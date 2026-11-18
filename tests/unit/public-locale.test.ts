import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { PUBLIC_LOCALES, publicAlternates, publicHref, resolvePublicLocale, isPublicPlatformPath } from '@/lib/marketing/public-locale'
import { translatePublic } from '@/lib/marketing/public-translate'
import { PublicLocaleProvider } from '@/components/marketing/PublicLocale'
import { anonymousPublicHtml } from '@/lib/site/cache-policy'
import { resolveSite } from '@/lib/site/resolve-site'
import { pickLegalDoc } from '@/lib/marketing/legal-doc'
import copy from '@/lib/marketing/public-copy.json'
import shell from '@/lib/marketing/public-shell-copy.json'

vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }))
import Landing from '@/app/(marketing)/ClientPage'
import Pricing from '@/app/(marketing)/pricing/PricingClient'
import { BlogPostList } from '@/components/blog/post-list'
import IdentityPilot from '@/app/identity/IdentityPilot'
import NativeRegister from '@/app/auth/register/NativeRegister'
import LegacyRegister from '@/app/auth/register/LegacyRegister'

describe('public language selection and navigation', () => {
  it('prefers explicit language, then saved preference, with a stable English default', () => {
    expect(resolvePublicLocale('pt-BR', 'es')).toBe('pt')
    expect(resolvePublicLocale('es', 'pt')).toBe('es')
    expect(resolvePublicLocale(null, 'pt')).toBe('pt')
    expect(resolvePublicLocale('invalid', 'es')).toBe('es')
    expect(resolvePublicLocale('invalid', 'invalid')).toBe('en')
  })
  it('preserves queries, fragments and nested return destinations', () => {
    expect(publicHref('/?signin=1#demo-store', 'pt')).toBe('/?signin=1&lang=pt#demo-store')
    expect(publicHref('/auth/login?from=%2Fdashboard&lang=en', 'es')).toBe('/auth/login?from=%2Fdashboard&lang=es')
    expect(publicHref('https://example.org', 'es')).toBe('https://example.org')
    expect(publicHref('//example.org', 'es')).toBe('//example.org')
    expect(publicAlternates('/pricing', 'pt').canonical).toBe('/pricing?lang=pt')
    expect(publicAlternates('/pricing').languages.es).toBe('/pricing?lang=es')
  })
  it('keeps administrative and tenant paths outside the platform language scope', () => {
    for (const path of ['/', '/pricing', '/blog/archive/2026', '/auth/login', '/identity']) expect(isPublicPlatformPath(path)).toBe(true)
    for (const path of ['/dashboard', '/tenants', '/aurora', '/api/orders', '/pricing-other']) expect(isPublicPlatformPath(path)).toBe(false)
  })
  it('never shares cache for language queries or saved language cookies', () => {
    const site = { ...resolveSite({ host: 'xprout.app', pathname: '/', tenant: null }), pathname: '/', rewrite: null, privatePage: false }
    expect(anonymousPublicHtml({ method: 'GET', url: 'https://xprout.app/', headers: new Headers() }, site)).toBe(true)
    expect(anonymousPublicHtml({ method: 'GET', url: 'https://xprout.app/?lang=pt', headers: new Headers() }, site)).toBe(false)
    expect(anonymousPublicHtml({ method: 'GET', url: 'https://xprout.app/', headers: new Headers({ cookie: 'xprout_public_lang=es' }) }, site)).toBe(false)
  })
})

describe('localized public rendering', () => {
  it.each(PUBLIC_LOCALES)('renders landing, pricing and blog shells in %s on the server', locale => {
    const render = (children: React.ReactNode) => renderToStaticMarkup(createElement(PublicLocaleProvider, { locale }, children))
    const landing = render(createElement(Landing, {}))
    const pricing = render(createElement(Pricing, {}))
    const blog = render(createElement(BlogPostList, { heading: 'Blog', posts: [], basePath: '/blog', locale }))
    expect(landing).toContain(translatePublic(locale, 'How it works'))
    expect(landing).toMatch(new RegExp(`<option(?=[^>]*value="${locale}")(?=[^>]*selected="")[^>]*>`))
    expect(pricing).toContain(translatePublic(locale, 'Setup · paid once'))
    expect(pricing).toContain(translatePublic(locale, 'Plan · paid monthly'))
    expect(pricing).toContain(`/pricing?lang=${locale}`)
    expect(blog).toContain(translatePublic(locale, 'No posts published yet.'))
  })
  it('keeps authored legal text unless a nonempty explicit translation exists', () => {
    const legal = { privacy: { title: 'Original', body: 'Original document', language: 'en', translations: { pt: { title: 'Traduzido', body: 'Documento traduzido' }, es: { body: '  ' } } } }
    expect(pickLegalDoc(legal, 'privacy', 'pt')).toMatchObject({ title: 'Traduzido', body: 'Documento traduzido', language: 'pt' })
    expect(pickLegalDoc(legal, 'privacy', 'es')).toMatchObject({ title: 'Original', body: 'Original document', language: 'en' })
    expect(translatePublic('pt', 'Saved customer copy')).toBe('Saved customer copy')
    expect(translatePublic('pt', 'constructor')).toBe('constructor')
    expect(translatePublic('es', '__proto__')).toBe('__proto__')
  })
  it.each(PUBLIC_LOCALES)('renders the platform sign-in and registration in %s without starting authentication', locale => {
    const config = { apiKey: 'fixture', projectId: 'fixture', authDomain: 'fixture.invalid' }
    const render = (children: React.ReactNode) => renderToStaticMarkup(createElement(PublicLocaleProvider, { locale }, children))
    const signin = render(createElement(IdentityPilot, { config, continueToApp: true, embedded: true }))
    const register = render(createElement(NativeRegister, { config, customer: false, next: '/' }))
    expect(signin.includes(translatePublic(locale, 'Sign in or create your account.'))).toBe(true)
    expect(signin.includes(translatePublic(locale, 'Continue'))).toBe(true)
    expect(register.includes(translatePublic(locale, 'Create your business account'))).toBe(true)
    expect(register).toContain(`lang=${locale}`)
  })
  it.each(PUBLIC_LOCALES)('keeps the legacy registration footer in the same %s locale as its form', locale => {
    const html = renderToStaticMarkup(createElement(PublicLocaleProvider, { locale }, createElement(LegacyRegister)))
    expect(html.includes(translatePublic(locale, 'Create your account'))).toBe(true)
    expect(html).toContain(`href="/?lang=${locale}"`)
  })
  it('has complete locale pairs and preserves interpolation tokens in every catalog entry', () => {
    for (const catalog of [copy, shell]) {
      expect(Object.keys(catalog.pt).sort()).toEqual(Object.keys(catalog.es).sort())
      for (const locale of ['pt', 'es'] as const) for (const [source, translated] of Object.entries(catalog[locale])) {
        expect(translated.trim(), `${locale}: ${source}`).not.toBe('')
        expect(translated.match(/\{\w+\}/g)?.sort() ?? [], `${locale}: ${source}`).toEqual(source.match(/\{\w+\}/g)?.sort() ?? [])
      }
    }
    expect(translatePublic('es', 'Enter the code we sent to {phone}', { phone: '+1234' })).toContain('+1234')
  })
})
