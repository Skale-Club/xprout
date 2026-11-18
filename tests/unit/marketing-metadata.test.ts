import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ settings: vi.fn(), locale: vi.fn() }))
vi.mock('@/lib/marketing/public-locale-server', () => ({ getPublicLocale: mocks.locale }))
vi.mock('@/lib/data/platform-settings', () => ({ platformSettingsOwned: () => true }))
vi.mock('@/lib/data/platform-settings-runtime', () => ({ readOwnedPlatformSettings: mocks.settings }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => { throw new Error('Unexpected legacy store') } }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
import { generateMetadata } from '@/app/(marketing)/page'
import { buildSoftwareApplicationJsonLd } from '@/lib/seo'
import copy from '@/lib/marketing/landing-copy.json'

beforeEach(() => { vi.clearAllMocks(); mocks.locale.mockResolvedValue('en') })

describe('current landing positioning and metadata', () => {
  it('renders translated metadata and a matching canonical language', async () => {
    mocks.locale.mockResolvedValue('pt')
    mocks.settings.mockResolvedValue(null)
    const metadata = await generateMetadata()
    expect(metadata.description).not.toBe(copy.seo.description)
    expect(metadata.openGraph).toMatchObject({ locale: 'pt_BR' })
    expect(metadata.alternates?.canonical).toBe('/?lang=pt')
    expect(metadata.alternates?.languages).toMatchObject({ es: '/?lang=es' })
  })
  it('uses the visual menu positioning without claiming free software', async () => {
    mocks.settings.mockResolvedValue(null)
    const metadata = await generateMetadata()
    expect(metadata.description).toBe(copy.seo.description)
    expect(copy.seo.description.length).toBeLessThanOrEqual(160)
    const software = buildSoftwareApplicationJsonLd({ name: 'Xprout' })
    expect(software).not.toHaveProperty('offers')
    expect(software).toHaveProperty('description', copy.seo.description)
  })

  it('keeps explicitly saved SEO copy and identity authoritative', async () => {
    mocks.settings.mockResolvedValue({ app_name: 'Configured identity', seo_title: 'Saved search title', seo_description: 'Saved search description' })
    const metadata = await generateMetadata()
    expect(metadata.title).toEqual({ absolute: 'Saved search title' })
    expect(metadata.description).toBe('Saved search description')
    expect(metadata.openGraph).toMatchObject({ title: 'Saved search title', description: 'Saved search description', siteName: 'Configured identity' })
  })
})
