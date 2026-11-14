/** The development identity origin is localhost (scripts/lib/dev-environment.mjs). */
export function developmentSignInRedirect(href: string, development: boolean): string | null {
  if (!development) return null
  try {
    const url = new URL(href)
    if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password) return null
    url.hostname = 'localhost'
    url.searchParams.set('signin', '1')
    return url.href
  } catch { return null }
}
