import { afterEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
const entry = vi.hoisted(() => ({ owned: vi.fn(() => 'owned-entry'),legacy: vi.fn(() => 'legacy-entry') }))
vi.mock('@/components/auth/IdentityEntry', () => ({ default: entry.owned }))
vi.mock('@/app/auth/login/LegacyLogin', () => ({ default: entry.legacy }))
// Login entry selection runs without Next's request store. Host authority is
// exercised separately by site request/middleware tests.
vi.mock('@/lib/site/request-runtime', () => ({ requestSite: vi.fn(async () => ({
  brand: { id: '00000000-0000-4000-8000-000000000001', name: 'Xprout', primary_host: 'xprout.app' },
})) }))
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })

it('server selects the native entry and exact link intent without rendering legacy login', async () => {
  vi.stubEnv('OWNED_AUTH_ENABLED','true')
  const { default: page } = await import('@/app/auth/login/page')
  expect(renderToStaticMarkup(await page({ searchParams: Promise.resolve({ action: 'existing-account-link',from: '/dashboard' }) }))).toBe('owned-entry')
  expect(entry.owned).toHaveBeenCalledWith(expect.objectContaining({ continueToApp: true,existingAccountLink: true,next: '/dashboard' }),undefined)
  expect(entry.legacy).not.toHaveBeenCalled()
})

it('server retains the legacy page only when owned mode is explicitly off', async () => {
  vi.stubEnv('OWNED_AUTH_ENABLED','false')
  const { default: page } = await import('@/app/auth/login/page')
  expect(renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }))).toBe('legacy-entry')
  expect(entry.owned).not.toHaveBeenCalled()
})
