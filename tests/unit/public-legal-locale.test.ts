import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { PublicLocaleProvider } from '@/components/marketing/PublicLocale'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PUBLIC_LOCALES } from '@/lib/marketing/public-locale'
import { translatePublic } from '@/lib/marketing/public-translate'

const mocks = vi.hoisted(() => ({ locale: vi.fn(), settings: vi.fn() }))
vi.mock('@/lib/marketing/public-locale-server', () => ({ getPublicLocale: mocks.locale }))
vi.mock('@/lib/data/platform-settings', () => ({ platformSettingsOwned: () => true }))
vi.mock('@/lib/data/platform-settings-runtime', () => ({ readOwnedPlatformSettings: mocks.settings }))
vi.mock('@/lib/marketing/marketing-chrome', () => ({ getMarketingChrome: async () => ({ appName: null, logoUrl: null, footerData: null }) }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => { throw new Error('Unexpected legacy store') } }))
import LegalPage from '@/components/legal/LegalPage'

beforeEach(() => vi.clearAllMocks())

describe('published legal language fallback', () => {
  it.each(PUBLIC_LOCALES)('renders the %s shell and preserves the original published document', async locale => {
    mocks.locale.mockResolvedValue(locale)
    mocks.settings.mockResolvedValue({ legal: { privacy: { title: 'Privacy Policy', body: 'Original published document', language: 'en' } } })
    const html = renderToStaticMarkup(createElement(PublicLocaleProvider, { locale }, await LegalPage({ docKey: 'privacy' })))
    expect(html.includes(translatePublic(locale, 'Privacy Policy'))).toBe(true)
    expect(html).toContain('Original published document')
    expect(html).toContain(`/terms?lang=${locale}`)
    expect(html.includes(translatePublic(locale, 'This document is shown in its original language.'))).toBe(locale !== 'en')
  })
  it('renders a published Portuguese translation instead of the original body', async () => {
    mocks.locale.mockResolvedValue('pt')
    mocks.settings.mockResolvedValue({ legal: { privacy: { body: 'Original published document', language: 'en', translations: { pt: { title: 'Política de Privacidade', body: 'Documento traduzido' } } } } })
    const html = renderToStaticMarkup(createElement(PublicLocaleProvider, { locale: 'pt' }, await LegalPage({ docKey: 'privacy' })))
    expect(html).toContain('Documento traduzido')
    expect(html).toContain('lang="pt"')
    expect(html).not.toContain('Original published document')
    expect(html).not.toContain(translatePublic('pt', 'This document is shown in its original language.'))
  })
})
