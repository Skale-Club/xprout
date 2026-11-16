import type { OrderQuery } from './orders'
import { OrderDataError } from './orders'
import { LOYALTY_NOT_READY, LOYALTY_READY_SQL, loyaltySettingsValid, pointsEarned, type LoyaltyState } from '../orders/loyalty'

/**
 * Loyalty reads and writes on the owned database, all inside the caller's order
 * transaction (checkout, the kitchen status change and the payment sync share
 * it, so a failure rolls the whole step back). The ledger is append-only and
 * its unique (order_id, kind) index makes every hook idempotent.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ONCE = 'ON CONFLICT (order_id, kind) WHERE order_id IS NOT NULL DO NOTHING'

export async function loyaltyReady(query: OrderQuery): Promise<boolean> {
  return (await query(LOYALTY_READY_SQL)).rows[0]?.ready === true
}

async function balanceOf(query: OrderQuery, tenantId: string, customerId: string): Promise<number> {
  const found = (await query('SELECT coalesce(sum(points),0)::int AS balance FROM public.loyalty_ledger WHERE tenant_id=$1 AND customer_id=$2', [tenantId, customerId])).rows[0]?.balance
  return Number.isInteger(found) ? Number(found) : 0
}

/** One writer per customer at a time: a redeem re-checks the balance only after the lock is held. */
async function lockCustomer(query: OrderQuery, tenantId: string, customerId: string) {
  await query('SELECT pg_advisory_xact_lock(hashtextextended($1,190733))', [`loyalty:${tenantId}:${customerId}`])
}

/** The restaurant's program and, for a signed-in customer, their balance. Not ready until the schema step ran. */
export async function readLoyaltyState(query: OrderQuery, tenantId: string, customerId: string | null): Promise<LoyaltyState> {
  if (!(await loyaltyReady(query))) return LOYALTY_NOT_READY
  const s = (await query(`SELECT loyalty_enabled AS enabled, loyalty_cents_per_point AS cpp, loyalty_reward_points AS rp, loyalty_reward_cents AS rc
    FROM public.tenant_settings WHERE tenant_id=$1 LIMIT 2`, [tenantId])).rows
  const row = s.length === 1 ? s[0] : null
  const settings = { centsPerPoint: row?.cpp, rewardPoints: row?.rp, rewardCents: row?.rc }
  if (!row || !loyaltySettingsValid(settings)) return { ...LOYALTY_NOT_READY, ready: true }
  const balance = customerId && UUID.test(customerId) ? await balanceOf(query, tenantId, customerId) : 0
  return { ready: true, enabled: row.enabled === true, centsPerPoint: Number(row.cpp), rewardPoints: Number(row.rp), rewardCents: Number(row.rc), balance }
}

/**
 * Spends `points` on the order just created. The advisory lock serializes every
 * writer of this customer's ledger, so the balance read after it is final: a
 * second concurrent redeem waits, then sees the first one's row and fails with
 * 409, which rolls the whole order back.
 */
export async function redeemLoyalty(query: OrderQuery, tenantId: string, orderId: string, customerId: string, points: number) {
  if (!UUID.test(orderId) || !UUID.test(customerId) || !Number.isInteger(points) || points < 1) throw new OrderDataError(400, 'Invalid order')
  await lockCustomer(query, tenantId, customerId)
  if (await balanceOf(query, tenantId, customerId) < points) throw new OrderDataError(409, 'Not enough loyalty points')
  const inserted = await query(`INSERT INTO public.loyalty_ledger (tenant_id, customer_id, order_id, kind, points) VALUES ($1,$2,$3,'redeem',$4) ${ONCE} RETURNING id`,
    [tenantId, customerId, orderId, -points])
  if (inserted.rows.length !== 1) throw new OrderDataError(409, 'Loyalty reward already used for this order')
  const updated = await query('UPDATE public.orders SET loyalty_points_redeemed=$4 WHERE tenant_id=$1 AND id=$2 AND customer_id=$3 RETURNING id', [tenantId, orderId, customerId, points])
  if (updated.rows.length !== 1) throw new OrderDataError(503, 'Order creation result is unavailable')
}

/**
 * Called in the transaction that moved an order to `done` or `cancelled`
 * (kitchen board or payment sync). done: credit the points once. cancelled: give
 * back the points the order spent and take back any credit it earned. A failure
 * here is logged by the caller and never blocks the kitchen: it runs in a savepoint.
 */
export async function settleLoyalty(query: OrderQuery, tenantId: string, orderId: string, status: string): Promise<{ earned: number; refunded: number; reversed: number }> {
  const none = { earned: 0, refunded: 0, reversed: 0 }
  if ((status !== 'done' && status !== 'cancelled') || !UUID.test(orderId)) return none
  if (!(await loyaltyReady(query))) return none
  const order = (await query('SELECT customer_id, subtotal, discount_cents, loyalty_points_redeemed FROM public.orders WHERE tenant_id=$1 AND id=$2 LIMIT 1', [tenantId, orderId])).rows[0]
  const customerId = order?.customer_id
  if (typeof customerId !== 'string' || !UUID.test(customerId)) return none
  await query('SAVEPOINT loyalty_settle')
  try {
    await lockCustomer(query, tenantId, customerId)
    const result = { ...none }
    if (status === 'done') {
      const state = await readLoyaltyState(query, tenantId, null)
      const points = state.ready && state.enabled ? pointsEarned(Math.round(Number(order.subtotal) * 100), Number(order.discount_cents ?? 0), state.centsPerPoint) : 0
      if (points > 0) {
        const inserted = await query(`INSERT INTO public.loyalty_ledger (tenant_id, customer_id, order_id, kind, points) VALUES ($1,$2,$3,'earn',$4) ${ONCE} RETURNING id`, [tenantId, customerId, orderId, points])
        if (inserted.rows.length === 1) result.earned = points
      }
    } else {
      const redeemed = Number(order.loyalty_points_redeemed ?? 0)
      if (Number.isInteger(redeemed) && redeemed > 0) {
        const inserted = await query(`INSERT INTO public.loyalty_ledger (tenant_id, customer_id, order_id, kind, points) VALUES ($1,$2,$3,'refund',$4) ${ONCE} RETURNING id`, [tenantId, customerId, orderId, redeemed])
        if (inserted.rows.length === 1) result.refunded = redeemed
      }
      const reversed = await query(`INSERT INTO public.loyalty_ledger (tenant_id, customer_id, order_id, kind, points)
        SELECT tenant_id, customer_id, order_id, 'reverse', -points FROM public.loyalty_ledger WHERE tenant_id=$1 AND order_id=$2 AND kind='earn' ${ONCE} RETURNING points`, [tenantId, orderId])
      if (reversed.rows.length === 1) result.reversed = -Number(reversed.rows[0].points)
    }
    await query('RELEASE SAVEPOINT loyalty_settle')
    return result
  } catch {
    await query('ROLLBACK TO SAVEPOINT loyalty_settle')
    await query('RELEASE SAVEPOINT loyalty_settle')
    return none
  }
}
