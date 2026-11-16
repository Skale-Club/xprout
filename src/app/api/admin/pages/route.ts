import { listOwnedPages, createOwnedPage } from '@/lib/data/tenant-pages-runtime'
import { authorizePages, pagesFailure, pagesJson } from '@/lib/pages/admin-api'
import { revalidatePublicMenu } from '@/lib/menu/public-menu-cache'
import { withApi } from '@/lib/observability/with-api'

export const dynamic = 'force-dynamic'

async function handleGET(request: Request) {
  try {
    const { response, context } = await authorizePages(request, false)
    if (response) return response
    return pagesJson(await listOwnedPages(context!))
  } catch (error) { return pagesFailure(error) }
}

async function handlePOST(request: Request) {
  try {
    const { response, context, slug } = await authorizePages(request, true)
    if (response) return response
    const page = await createOwnedPage(context!, await request.json())
    revalidatePublicMenu(slug)
    return pagesJson({ page }, 201)
  } catch (error) { return pagesFailure(error) }
}

export const GET = withApi('GET /api/admin/pages', handleGET)
export const POST = withApi('POST /api/admin/pages', handlePOST)
