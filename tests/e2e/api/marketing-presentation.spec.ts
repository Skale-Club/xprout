import { expect, test } from '@playwright/test'

// Network fixtures must own the frame request; the production SW otherwise
// forwards navigation outside page.route and reaches the real identity entry.
test.use({ serviceWorkers: 'block' })

const entry = '<html><body style="margin:0;background:#f3efe5"><main style="height:360px;padding:24px;box-sizing:border-box"><h1>Welcome back.</h1><label>Phone<input type="tel"></label></main></body></html>'

test.beforeEach(async ({ page }) => {
  // Do not require the newer AbortSignal.timeout API on supported older phones.
  await page.addInitScript(() => { Object.defineProperty(AbortSignal, 'timeout', { value: undefined, configurable: true }) })
  // Exercise the popup without identity provider calls or a real sign-in.
  await page.route('**/api/auth/authority', route => route.fulfill({ json: { authority: 'owned' } }))
  await page.route('**/api/identity/session', route => route.fulfill({ status: 401, json: {} }))
})

for (const width of [320, 390, 1440]) {
  test(`header progress and sign-in remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.route('**/auth/login?embed=1', route => route.fulfill({ contentType: 'text/html', body: entry }))
    await page.goto('/')
    await page.locator('#how-it-works').scrollIntoViewIfNeeded()
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const geometry = await nav.evaluate(el => {
      const bar = el.querySelector('.mk-scroll-progress')!
      return { navBottom: el.getBoundingClientRect().bottom, barBottom: bar.getBoundingClientRect().bottom, position: getComputedStyle(bar).position }
    })
    expect(geometry.position).toBe('absolute')
    expect(Math.abs(geometry.navBottom - geometry.barBottom)).toBeLessThanOrEqual(1)
    const start = nav.getByRole('button', { name: /^Start(?: your project)?$/ })
    expect((await start.boundingBox())!.width).toBeGreaterThanOrEqual(80)
    if (width < 768) await nav.getByRole('button', { name: 'Open navigation' }).click()
    await start.click()
    await expect(page.getByRole('button', { name: 'Close navigation' })).toHaveCount(0)
    const dialog = page.getByRole('dialog', { name: 'Sign in to Xprout' })
    await expect(page.frameLocator('iframe[title="Sign in to Xprout"]').getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
    expect((await dialog.boundingBox())!.height).toBeGreaterThan(160)
    await dialog.getByRole('button', { name: 'Close sign in' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(start).toBeFocused()
  })
}

test('a rejected sign-in document shows recovery instead of a collapsed overlay', async ({ page }) => {
  let attempts = 0
  await page.route('**/auth/login?embed=1', route => {
    attempts++
    return attempts === 1
      ? route.fulfill({ status: 404, contentType: 'text/html', body: '<html><body>Not found</body></html>' })
      : route.fulfill({ contentType: 'text/html', body: entry })
  })
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /^Start/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Sign in to Xprout' })
  await expect(dialog.getByRole('alert')).toHaveText('Sign-in could not load. Please try again.')
  expect((await dialog.boundingBox())!.height).toBeGreaterThan(100)
  await dialog.getByRole('button', { name: 'Try again' }).click()
  await expect(page.frameLocator('iframe[title="Sign in to Xprout"]').getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Close sign in' }).click()
  await expect(dialog).toHaveCount(0)
})
