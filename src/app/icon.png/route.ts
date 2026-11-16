import { siteIconResponse } from '@/lib/site/icon-response'
export const dynamic = 'force-dynamic'
export const GET = (request: Request) => siteIconResponse(request)
