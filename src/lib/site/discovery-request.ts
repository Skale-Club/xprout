import { loadSiteBrand } from './runtime'
import { parseRequestSite, SITE_CONTEXT_HEADER } from './request-contract'
import { resolveSite } from './resolve-site'

/** Middleware has already resolved the exact host, including brand/apex gates. */
export async function discoveryRequestSite(request: Request) {
  const supplied = parseRequestSite(request.headers.get(SITE_CONTEXT_HEADER))
  if (supplied) return supplied
  return resolveSite({ host: request.headers.get('host') ?? new URL(request.url).host,
    pathname: new URL(request.url).pathname, tenant: null, brand: await loadSiteBrand() })
}
