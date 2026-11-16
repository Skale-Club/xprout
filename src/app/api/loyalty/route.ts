import { NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { withApi } from '@/lib/observability/with-api'
import { ordersDataOwned } from '@/lib/data/orders'
import { withOwnedOrders } from '@/lib/data/orders-runtime'
import { ownedAuthSelected } from '@/lib/auth/owned-principal'
import { getOwnedCustomer } from '@/lib/auth/owned-customer-runtime'
import { LOYALTY_NOT_READY } from '@/lib/orders/loyalty'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

/**
 * The loyalty program of a restaurant and, for a signed-in customer, their balance
 * (checkout shows "Use reward"). Per customer, so never cached. Owned database only:
 * anywhere else the program simply reports itself as off. POST /api/orders re-checks
 * everything; this is display data.
 */
async function handleGET(request: Request) {
  const limited = await rateLimit('loyalty-read', getClientIp(request), 30, '1 m')
  if (!limited.ok) return json({ error: 'Too many requests. Please slow down.' }, 429)
  const parsed = z.string().uuid().safeParse(new URL(request.url).searchParams.get('tenant_id'))
  if (!parsed.success) return json({ error: 'Invalid request' }, 400)
  const off = { enabled: false, signed_in: false, balance: 0, reward_points: LOYALTY_NOT_READY.rewardPoints, reward_cents: LOYALTY_NOT_READY.rewardCents }
  if (!ordersDataOwned() || !ownedAuthSelected()) return json(off)
  const customer = await getOwnedCustomer()
  const state = await withOwnedOrders(parsed.data, false, async owned => {
    const tenant = (await owned.tenantSettings()).data
    if (!tenant?.is_active || !tenant.tenant_settings?.orders_enabled) return null
    if (!(await owned.capabilities(tenant.tenant_settings)).guestOrdering) return null
    return owned.loyaltyState(customer?.userId ?? null)
  })
  if (!state?.ready || !state.enabled) return json(off)
  return json({ enabled: true, signed_in: !!customer, balance: state.balance, reward_points: state.rewardPoints, reward_cents: state.rewardCents })
}

export const GET = withApi('GET /api/loyalty', handleGET)
