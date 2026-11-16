import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { assertLocalSupabase, db } from '../fixtures/db'
import { dishSlug } from '../../../src/lib/menu/dish-pages'
import { SITE_CONTEXT_HEADER, SITE_PATH_HEADER } from '../../../src/lib/site/request-contract'

test.describe.configure({ mode: 'serial' })
const token = randomUUID().slice(0, 8)
const tenantId = randomUUID(), demoId = randomUUID(), brandId = randomUUID()
const partnerTenantId = randomUUID(), companyTenantId = randomUUID(), partnerMenuId = randomUUID()
const menuId = randomUUID(), privateMenuId = randomUUID(), productId = randomUUID(), privateProductId = randomUUID()
const slug = `seo-${token}`, host = `restaurant-${token}.example.org`, partnerHost = `partner-${token}.example.org`
const name = `SEO Restaurant ${token}`, partnerName = `Independent Brand ${token}`
const partnerSlug = `partner-restaurant-${token}`, companySlug = `company-${token}`
const publicDish = { id: productId, name: 'Tomato Soup' }
const dish = dishSlug(publicDish)
const head = (html: string) => html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? html
const canonical = (html: string) => (html.match(/<link\b[^>]*>/gi) ?? []).find(tag => /rel=["']canonical["']/i.test(tag))?.match(/href=["']([^"']*)/i)?.[1]
const checked = <T extends { error: unknown }>(result: T) => { if (result.error) throw result.error; return result }

test.beforeAll(async () => {
  assertLocalSupabase()
  checked(await db().from('brands').insert({ id: brandId, name: partnerName, primary_host: partnerHost, extra_hosts: [], default_lang: 'en', show_powered_by: false,
    icon: '/brands/aurora-kitchen-bar/logo.webp', logo: '/brands/aurora-kitchen-bar/logo.webp', social_image: '/brands/aurora-kitchen-bar/banner.webp' }))
  checked(await db().from('tenants').insert([
    { id: tenantId, slug, name, is_active: true, is_demo: false, published_at: '2026-01-01T00:00:00Z', custom_domain: host, custom_domain_verified: true },
    { id: demoId, slug: `demo-${token}`, name: 'Unpublished synthetic demo', is_active: true, is_demo: true, published_at: null },
    { id: partnerTenantId, slug: partnerSlug, name: 'Partner Restaurant', brand_id: brandId, is_active: true, is_demo: false, published_at: '2026-01-01T00:00:00Z' },
    { id: companyTenantId, slug: companySlug, name: partnerName, brand_id: brandId, business_kind: 'software', is_active: true, is_demo: false, published_at: '2026-01-01T00:00:00Z' },
  ]))
  checked(await db().from('tenant_settings').insert({ tenant_id: tenantId, language: 'pt', currency: 'USD', visual_feed_enabled: false, menu_default_view: 'list',
    address: '10 Example Street', city: 'Example City', phone: '+1 212 555 0100', business_hours: { mon: '09:00-21:00' }, seo_noindex: false,
    orders_enabled: false, direct_orders_enabled: false, logo_url: '/brands/aurora-kitchen-bar/logo.webp' }))
  checked(await db().from('tenant_settings').insert([
    { tenant_id: partnerTenantId, language: 'fr', currency: 'EUR', seo_noindex: false, orders_enabled: false, direct_orders_enabled: false, visual_feed_enabled: false },
    { tenant_id: companyTenantId, language: 'es', currency: 'USD', seo_noindex: false, about: 'Independent software for local businesses.', orders_enabled: false, direct_orders_enabled: false, visual_feed_enabled: false },
  ]))
  checked(await db().from('brands').update({ apex_tenant_id: companyTenantId, apex_home_slug: 'home' }).eq('id', brandId))
  checked(await db().from('menus').insert([
    { id: menuId, tenant_id: tenantId, name: 'Dinner', slug: 'dinner', language: 'pt', supported_languages: ['pt'], is_active: true, is_default: true, is_private: false },
    { id: privateMenuId, tenant_id: tenantId, name: 'Private menu', slug: 'members', language: 'pt', supported_languages: ['pt'], is_active: true, is_default: false, is_private: true },
    { id: partnerMenuId, tenant_id: partnerTenantId, name: 'Partner menu', slug: 'dinner', language: 'fr', supported_languages: ['fr'], is_active: true, is_default: true, is_private: false },
  ]))
  checked(await db().from('products').insert([
    { id: productId, tenant_id: tenantId, menu_id: menuId, name: publicDish.name, description: 'Roasted tomatoes and basil.', price: 12.50, is_available: true, image_url: '/brands/aurora-kitchen-bar/artisan-burger.webp' },
    { id: privateProductId, tenant_id: tenantId, menu_id: privateMenuId, name: `CONFIDENTIAL-DISH-${token}`, description: 'This content must never enter a public response.', price: 50, is_available: true, image_url: '/brands/aurora-kitchen-bar/artisan-burger.webp' },
  ]))
})

test.afterAll(async () => {
  assertLocalSupabase()
  checked(await db().from('tenants').delete().in('id', [tenantId, demoId, partnerTenantId, companyTenantId]))
  checked(await db().from('brands').delete().eq('id', brandId))
})

test('raw tenant SSR has canonical identity, language, Restaurant data and crawlable dish links', async ({ request }) => {
  const response = await request.get('/', { headers: { host } })
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(canonical(html)).toBe(`https://${host}`)
  expect(html).toMatch(/<html[^>]+lang=["']pt(?:-BR)?["']/i)
  expect(html).toContain(`${host}#restaurant`)
  expect(html).toMatch(/"@type"\s*:\s*"Restaurant"/)
  expect(html).toContain('10 Example Street')
  expect(html).toContain(`/dinner/${dish}`)
  expect(response.headers()['cache-control']).toContain('s-maxage=60')
  expect(response.headers()['set-cookie']).toBeUndefined()
})

test('dish content is server rendered and private dishes never leak', async ({ request }) => {
  const response = await request.get(`/dinner/${dish}`, { headers: { host } })
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(canonical(html)).toBe(`https://${host}/dinner/${dish}`)
  expect(html).toContain('Roasted tomatoes and basil.')
  expect(html).toMatch(/"@type"\s*:\s*"MenuItem"/)
  const privateDish = dishSlug({ id: privateProductId, name: `CONFIDENTIAL-DISH-${token}` })
  const hidden = await request.get(`/members/${privateDish}`, { headers: { host } })
  expect(hidden.status()).toBe(404)
  expect(await hidden.text()).not.toContain(`CONFIDENTIAL-DISH-${token}`)
  const privateMenu = await request.get('/members', { headers: { host } })
  expect(privateMenu.headers()['x-robots-tag']).toContain('noindex')
  expect(privateMenu.headers()['cache-control']).toContain('no-store')
  expect(await privateMenu.text()).not.toContain(`CONFIDENTIAL-DISH-${token}`)
})

test('sitemaps exclude demos and private dishes while listing the eligible dish', async ({ request }) => {
  const tenantMap = await request.get('/sitemap.xml', { headers: { host } })
  expect(tenantMap.status()).toBe(200)
  const xml = await tenantMap.text()
  expect(xml).toContain(`https://${host}/dinner/${dish}`)
  expect(xml).not.toContain('members')
  const platformMap = await request.get('/sitemap.xml', { headers: { host: 'xprout.app' } })
  expect(platformMap.status()).toBe(200)
  expect(await platformMap.text()).not.toContain(`/demo-${token}/`)
  expect((await request.get(`/demo-${token}/sitemap.xml`, { headers: { host: 'xprout.app' } })).status()).toBe(404)
})

test('spoofed site context cannot change public metadata', async ({ request }) => {
  const response = await request.get('/', { headers: { host,
    [SITE_CONTEXT_HEADER]: encodeURIComponent(JSON.stringify({ origin: 'https://evil.example.org', brand: { id: 'evil', name: 'INJECTED-BRAND' }, lang: 'zz', indexable: true, pathname: '/', kind: 'brand' })),
    [SITE_PATH_HEADER]: '/admin' } })
  const html = await response.text()
  expect(canonical(html)).toBe(`https://${host}`)
  expect(head(html)).not.toContain('INJECTED-BRAND')
  expect(head(html)).not.toContain('evil.example.org')
})

test('cookie, parameter and RSC requests bypass shared cache without leaking another visitor marker', async ({ request }) => {
  const cases: Array<{ path: string; extra: Record<string, string> }> = [
    { path: '/', extra: { cookie: `seo-visitor=first-${token}` } },
    { path: '/', extra: { cookie: `seo-visitor=second-${token}` } },
    { path: '/?table=fixture', extra: {} }, { path: '/?lang=pt', extra: {} }, { path: '/?view=feed', extra: {} },
    { path: '/', extra: { RSC: '1' } },
  ]
  for (const fixture of cases) {
    const response = await request.get(fixture.path, { headers: { host, ...fixture.extra } })
    expect(response.headers()['cache-control']).toMatch(/private.*no-store/)
    expect(response.headers()['cf-cache-status']).not.toBe('HIT')
    const body = await response.text()
    expect(body).not.toContain(`first-${token}`)
    expect(body).not.toContain(`second-${token}`)
  }
})

test('partner host owns root metadata, robots, sitemap and manifest identity', async ({ request }) => {
  const response = await request.get('/', { headers: { host: partnerHost } })
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(canonical(html)).toBe(`https://${partnerHost}`)
  expect(html).toMatch(/<html[^>]+lang=["']es["']/i)
  expect(head(html)).toContain(partnerName)
  expect(head(html)).not.toMatch(/Xprout|xprout\.app/i)
  const robots = await request.get('/robots.txt', { headers: { host: partnerHost } })
  expect(await robots.text()).toContain(`https://${partnerHost}/sitemap.xml`)
  const sitemap = await request.get('/sitemap.xml', { headers: { host: partnerHost } })
  expect(sitemap.status()).toBe(200)
  expect(await sitemap.text()).not.toContain('xprout.app')
  const manifest = await request.get('/manifest.webmanifest', { headers: { host: partnerHost } })
  expect(await manifest.json()).toMatchObject({ name: partnerName })
  expect(await manifest.text()).not.toMatch(/Xprout|xprout\.app/i)
})

test('partner tenant and company apex use their assigned host authority without cross-brand canonicals', async ({ request }) => {
  const response = await request.get(`/${partnerSlug}`, { headers: { host: partnerHost } })
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(canonical(html)).toBe(`https://${partnerHost}/${partnerSlug}`)
  expect(html).toMatch(/<html[^>]+lang=["']fr["']/i)
  expect(head(html)).not.toMatch(/Xprout|xprout\.app/i)
  const apex = await request.get('/', { headers: { host: partnerHost } })
  const body = await apex.text()
  expect(canonical(body)).toBe(`https://${partnerHost}`)
  expect(body).toContain(partnerName)
  expect(body).toContain('SoftwareApplication')
  expect(body).not.toMatch(/"@type"\s*:\s*"Restaurant"/)
})

test('partner social image is an actually bounded PNG and icon retains partner identity', async ({ request }) => {
  const image = await request.get('/opengraph-image', { headers: { host: partnerHost } })
  expect(image.status()).toBe(200)
  expect(image.headers()['content-type']).toContain('image/png')
  const bytes = await image.body()
  expect(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true)
  expect(bytes.readUInt32BE(16)).toBe(1200)
  expect(bytes.readUInt32BE(20)).toBe(630)
  expect(bytes.byteLength).toBeLessThanOrEqual(180 * 1024)
  const icon = await request.get('/icon.png', { headers: { host: partnerHost }, maxRedirects: 0 })
  expect([200, 307]).toContain(icon.status())
  if (icon.status() === 307) expect(icon.headers().location).toContain('/brands/aurora-kitchen-bar/logo.webp')
  else expect(await icon.text()).not.toMatch(/Xprout|xprout\.app/i)
})

test('internal site lookup rejects public Host and forwarded loopback callers', async ({ request }) => {
  const callers: Record<string, string>[] = [{ host }, { host: 'localhost', 'x-forwarded-for': '203.0.113.1' }]
  for (const headers of callers) {
    const response = await request.get(`/api/internal/resolve-site?host=${host}&path=/`, { headers })
    expect(response.status()).toBe(404)
    expect(response.headers()['cache-control']).toContain('no-store')
  }
})

test('mobile and desktop menu/dish screenshots retain readable read-only layouts without overflow', async ({ page }, testInfo) => {
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    // Local paths intentionally avoid external DNS and custom browser Host overrides.
    await page.goto(`/${slug}`)
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
    await expect(page.locator(`a[href$="/dinner/${dish}"]`).first()).toHaveAttribute('href', `https://${host}/dinner/${dish}`)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    await expect(page.getByRole('button', { name: /add to cart|view cart|checkout|adicionar ao carrinho|finalizar pedido/i })).toHaveCount(0)
    await testInfo.attach(`menu-${width}.png`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

    await page.goto(`/${slug}/dinner/${dish}`)
    await expect(page.getByRole('heading', { name: publicDish.name, exact: true })).toBeVisible()
    await expect(page.getByText('Roasted tomatoes and basil.', { exact: true })).toBeVisible()
    await expect(page.locator('.tabular-nums')).toContainText('12,50')
    const photo = page.getByRole('img', { name: publicDish.name, exact: true })
    await expect(photo).toBeVisible()
    await expect.poll(async () => photo.evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true)
    await expect(page.getByRole('link', { name: 'Dinner', exact: true }).last()).toHaveAttribute('href', `https://${host}/dinner`)
    await expect(page.getByRole('button', { name: /add|cart|checkout|adicionar|carrinho/i })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    await testInfo.attach(`dish-${width}.png`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  }
})
