import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { mutateAdminStoreSettings } from '@/lib/data/admin-store-settings'
import { normalizeActionUrl, resolveMenuActionLinks, visibleFooterBrand } from '@/lib/menu-action-links'

const context = { tenantId: randomUUID(), role: 'store-admin' as const }

describe('action link URL validation', () => {
  it('turns empty values into null and keeps valid https URLs', () => {
    expect(normalizeActionUrl('')).toEqual({ ok: true, value: null })
    expect(normalizeActionUrl('   ')).toEqual({ ok: true, value: null })
    expect(normalizeActionUrl(null)).toEqual({ ok: true, value: null })
    expect(normalizeActionUrl(' https://www.opentable.com/r/casa ')).toEqual({ ok: true, value: 'https://www.opentable.com/r/casa' })
  })

  it('rejects anything but an https URL of at most 500 characters', () => {
    for (const bad of ['http://example.com', 'javascript:alert(1)', 'example.com', 'https://', 'https://exa mple.com', 42, {}]) {
      expect(normalizeActionUrl(bad)).toEqual({ ok: false })
    }
    const long = `https://example.com/${'a'.repeat(481)}`
    expect(long.length).toBe(501)
    expect(normalizeActionUrl(long)).toEqual({ ok: false })
    expect(normalizeActionUrl(long.slice(0, 500))).toMatchObject({ ok: true })
  })
})

describe('public menu rendering decisions', () => {
  it('hides the footer brand only when the restaurant switched it off', () => {
    expect(visibleFooterBrand('Xprout', { hide_platform_brand: true })).toBe('')
    expect(visibleFooterBrand('Xprout', { hide_platform_brand: false })).toBe('Xprout')
    expect(visibleFooterBrand('Xprout', null)).toBe('Xprout')
  })

  it('shows "Order online" only without guest checkout, and "Reserve" always when set', () => {
    const settings = { order_online_url: 'https://order.example.com', reservation_url: 'https://resy.com/r/x' }
    expect(resolveMenuActionLinks(settings, { guestOrdering: false })).toEqual({ orderOnlineUrl: 'https://order.example.com', reservationUrl: 'https://resy.com/r/x' })
    expect(resolveMenuActionLinks(settings, { guestOrdering: true })).toEqual({ orderOnlineUrl: null, reservationUrl: 'https://resy.com/r/x' })
    expect(resolveMenuActionLinks({}, { guestOrdering: false })).toEqual({ orderOnlineUrl: null, reservationUrl: null })
  })

  it('never renders a stored value that is not https', () => {
    expect(resolveMenuActionLinks({ order_online_url: 'javascript:alert(1)', reservation_url: 'http://x.com' }, { guestOrdering: false }))
      .toEqual({ orderOnlineUrl: null, reservationUrl: null })
  })
})

describe('store settings save with action links', () => {
  function queryFor(linksReady: boolean) {
    return vi.fn(async (sql: string, values?: unknown[]) => {
      if (sql.includes('tenant_subscriptions')) return { rows: [{ status: 'active', features: ['payments'] }] }
      if (sql.includes('information_schema.columns')) return { rows: [{ ready: linksReady }] }
      if (sql.includes('FOR UPDATE')) return { rows: [{ currency: 'USD' }] }
      if (sql.includes('INSERT INTO public.tenant_settings')) return { rows: [{ currency: 'USD', echoed: values }] }
      return { rows: [] }
    })
  }

  it('stores validated links, empty as NULL, and rejects non-https with 400', async () => {
    const query = queryFor(true)
    await mutateAdminStoreSettings(query, context, { order_online_url: ' https://order.example.com ', reservation_url: '', hide_platform_brand: true })
    const insert = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO public.tenant_settings'))!
    expect(insert[0]).toContain('order_online_url')
    expect(insert[0]).toContain('RETURNING')
    expect(insert[1]).toEqual([context.tenantId, 'https://order.example.com', null, true])
    await expect(mutateAdminStoreSettings(query, context, { reservation_url: 'http://insecure.example.com' })).rejects.toMatchObject({ status: 400 })
    await expect(mutateAdminStoreSettings(query, context, { order_online_url: `https://x.com/${'a'.repeat(500)}` })).rejects.toMatchObject({ status: 400 })
    await expect(mutateAdminStoreSettings(query, context, { hide_platform_brand: 'yes' })).rejects.toMatchObject({ status: 400 })
  })

  it('tolerates the columns not existing yet: defaults are ignored, real changes refused', async () => {
    const query = queryFor(false)
    await mutateAdminStoreSettings(query, context, { currency: 'USD', order_online_url: null, reservation_url: null, hide_platform_brand: false })
    const insert = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO public.tenant_settings'))!
    expect(insert[0]).not.toContain('order_online_url')
    await expect(mutateAdminStoreSettings(query, context, { reservation_url: 'https://resy.com/r/x' })).rejects.toMatchObject({ status: 503 })
  })
})
