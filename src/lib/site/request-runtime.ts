import { cache } from 'react'
import { headers } from 'next/headers'
import { ownedModeActive } from '../data/owned-mode'
import { parseRequestSite, SITE_CONTEXT_HEADER, SITE_PATH_HEADER } from './request-contract'
import { readRequestSite } from './request-data'
import { resolveSite } from './resolve-site'

/** Middleware context is public identity only; it never contains visitor/session state. */
export const requestSite = cache(async () => {
  const requestHeaders = await headers()
  const supplied = parseRequestSite(requestHeaders.get(SITE_CONTEXT_HEADER))
  if (supplied) return supplied
  const host = requestHeaders.get('host') ?? ''
  const pathname = requestHeaders.get(SITE_PATH_HEADER) ?? '/'
  if (ownedModeActive()) {
    const { ownedAdminTransaction } = await import('../data/admin-menus-runtime')
    return ownedAdminTransaction(false, query => readRequestSite(query, host, pathname))
  }
  // Legacy development has the same identity contract. A missing configuration
  // during a fixture/build still yields noindex defaults, never a foreign host.
  try {
    const { legacyRequestSite } = await import('./legacy-request')
    return await legacyRequestSite(host, pathname)
  } catch {
    const site = resolveSite({ host, pathname, tenant: null, preview: true })
    return { ...site, pathname, rewrite: null, privatePage: false }
  }
})
