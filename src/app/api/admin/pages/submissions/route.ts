import { listOwnedSubmissions } from '@/lib/data/tenant-pages-runtime'
import { authorizePages, pagesFailure, pagesJson } from '@/lib/pages/admin-api'
import { withApi } from '@/lib/observability/with-api'

export const dynamic = 'force-dynamic'

/** ?page=<id> narrows to one page. */
async function handleGET(request: Request) {
  try {
    const { response, context } = await authorizePages(request, false)
    if (response) return response
    return pagesJson(await listOwnedSubmissions(context!, new URL(request.url).searchParams.get('page')))
  } catch (error) { return pagesFailure(error) }
}

export const GET = withApi('GET /api/admin/pages/submissions', handleGET)
