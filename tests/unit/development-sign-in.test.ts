import { describe, expect, it } from 'vitest'
import { developmentSignInRedirect } from '@/lib/auth/development-sign-in'

describe('canonical development sign-in', () => {
  it.each(['127.0.0.1', '[::1]'])('moves only the development loopback alias %s to localhost', host => {
    expect(developmentSignInRedirect(`http://${host}:3255/?preview=1#demo-store`, true))
      .toBe('http://localhost:3255/?preview=1&signin=1#demo-store')
  })
  it.each(['https://xprout.app/', 'http://localhost:3255/', 'http://example.com:3255/', 'https://127.0.0.1:3255/', 'http://name:password@127.0.0.1:3255/', 'invalid'])('never redirects %s', href => {
    expect(developmentSignInRedirect(href, true)).toBeNull()
  })
  it('never changes a production URL, including loopback', () => {
    expect(developmentSignInRedirect('http://127.0.0.1:3255/', false)).toBeNull()
  })
})
