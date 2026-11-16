import { deleteOwnedPage, getOwnedPage, moveOwnedPage, updateOwnedPage } from '@/lib/data/tenant-pages-runtime'
import { authorizePages, pagesFailure, pagesJson } from '@/lib/pages/admin-api'
import { revalidatePublicMenu } from '@/lib/menu/public-menu-cache'
import { withApi } from '@/lib/observability/with-api'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

async function handleGET(request: Request, { params }: Params) {
  try {
    const { response, context } = await authorizePages(request, false)
    if (response) return response
    return pagesJson({ page: await getOwnedPage(context!, (await params).id) })
  } catch (error) { return pagesFailure(error) }
}

/** The editor sends the whole page: fields and sections. */
async function handlePUT(request: Request, { params }: Params) {
  try {
    const { response, context, slug } = await authorizePages(request, true)
    if (response) return response
    const page = await updateOwnedPage(context!, (await params).id, await request.json())
    revalidatePublicMenu(slug)
    return pagesJson({ page })
  } catch (error) { return pagesFailure(error) }
}

/** Body { move: 'up' | 'down' }: the page's place in the navigation. */
async function handlePATCH(request: Request, { params }: Params) {
  try {
    const { response, context, slug } = await authorizePages(request, true)
    if (response) return response
    const body = await request.json() as { move?: unknown }
    const result = await moveOwnedPage(context!, (await params).id, body?.move)
    revalidatePublicMenu(slug)
    return pagesJson(result)
  } catch (error) { return pagesFailure(error) }
}

async function handleDELETE(request: Request, { params }: Params) {
  try {
    const { response, context, slug } = await authorizePages(request, true)
    if (response) return response
    const result = await deleteOwnedPage(context!, (await params).id)
    revalidatePublicMenu(slug)
    return pagesJson(result)
  } catch (error) { return pagesFailure(error) }
}

export const GET = withApi('GET /api/admin/pages/[id]', handleGET)
export const PUT = withApi('PUT /api/admin/pages/[id]', handlePUT)
export const PATCH = withApi('PATCH /api/admin/pages/[id]', handlePATCH)
export const DELETE = withApi('DELETE /api/admin/pages/[id]', handleDELETE)
