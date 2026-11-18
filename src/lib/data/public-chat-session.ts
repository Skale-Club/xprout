import { hashPhone } from '../crypto'
import { AdminMenuError, type AdminMenuQuery } from './admin-menus'
import { presentChatSwitchColumnsFor, switchOn } from './chat-switch-columns'
import { DEFAULT_MAX_MESSAGES_PER_CONVERSATION, isConversationReusable, normalizeConversationCap } from '../chat-limits'

function unique(rows: Record<string, unknown>[]) {
  if (rows.length > 1) throw new AdminMenuError(503, 'Chat information is unavailable')
  return rows[0]
}

/** Mirrors addon availability/override semantics; this is not an Auth identity. */
export async function readPublicChatAddon(query: AdminMenuQuery, tenantId: string) {
  const subscription = unique((await query(`SELECT s.chat_addon_active,s.chat_addon_override,p.chat_addon_available
    FROM public.tenant_subscriptions s LEFT JOIN public.plans p ON p.id=s.plan_id WHERE s.tenant_id=$1 LIMIT 2`, [tenantId])).rows)
  const settings = unique((await query(`SELECT enabled,rate_limit_per_phone_per_day FROM public.chat_addon_settings WHERE tenant_id=$1 LIMIT 2`, [tenantId])).rows)
  const available = subscription?.chat_addon_available === true
  const override = subscription?.chat_addon_override
  const active = override === true || (override !== false && available && subscription?.chat_addon_active === true)
  return {
    status: { available: available || override === true, active, enabled: active && settings?.enabled === true, overrideApplied: override === true || override === false },
    rateLimit: settings?.rate_limit_per_phone_per_day ?? 30,
  }
}

async function usedLast24h(query: AdminMenuQuery, tenantId: string, phoneHash: string, now: Date) {
  const used = await query(`SELECT count(*)::int AS used FROM public.chat_messages m JOIN public.chat_conversations c ON c.id=m.conversation_id
    WHERE c.tenant_id=$1 AND c.phone_hash=$2 AND m.role='user' AND m.created_at>=$3`, [tenantId, phoneHash, new Date(now.getTime() - 86400000).toISOString()])
  return Number(used.rows[0]?.used) || 0
}

/**
 * Tenant-scoped conversation reuse for the guest whose phone was verified by SMS
 * (`verifiedPhone`, E.164, read from the session by the route, never from the body);
 * phone digits never enter SQL.
 */
export async function createPublicChatSession(query: AdminMenuQuery, slug: string, verifiedPhone: unknown, now = new Date()) {
  const digits = typeof verifiedPhone === 'string' ? verifiedPhone.replace(/\D/g, '') : ''
  if (digits.length < 8 || digits.length > 15) throw new AdminMenuError(400, 'Invalid phone number')
  if (!Number.isFinite(now.getTime())) throw new AdminMenuError(503, 'Chat information is unavailable')
  const tenant = unique((await query(`SELECT id FROM public.tenants WHERE slug=$1 AND is_active=true LIMIT 2 FOR SHARE`, [slug])).rows)
  if (!tenant || typeof tenant.id !== 'string') throw new AdminMenuError(404, 'Tenant not found')
  const { status, rateLimit } = await readPublicChatAddon(query, tenant.id)
  if (!status.enabled) throw new AdminMenuError(403, 'Chat addon not enabled')
  const phoneHash = hashPhone(digits, tenant.id)
  // Fixed namespace + tenant-scoped hash prevents duplicate first-use sessions
  // among native writers without a schema/index migration or a global lock.
  await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`xmartmenu-chat-session:${tenant.id}:${phoneHash}`])
  const blocked = unique((await query(`SELECT id FROM public.chat_blocked_phones WHERE tenant_id=$1 AND phone_hash=$2 LIMIT 2`, [tenant.id, phoneHash])).rows)
  if (blocked) throw new AdminMenuError(403, 'This number is not allowed to use the assistant')
  const start = new Date(now); start.setUTCHours(0, 0, 0, 0)
  // history_enabled off (a shared tablet): never reuse an earlier conversation; each
  // session starts from zero. Limits and the blocklist above/below still go by phone hash.
  // The column may not exist yet (schema step runs after deploy): missing = on.
  let historyOn = true, cap = DEFAULT_MAX_MESSAGES_PER_CONVERSATION
  const present = await presentChatSwitchColumnsFor(query)
  const wanted = (['history_enabled', 'max_messages_per_conversation'] as const).filter(column => present.has(column))
  if (wanted.length) {
    const row = unique((await query(`SELECT ${wanted.join(',')} FROM public.chat_addon_settings WHERE tenant_id=$1 LIMIT 2`, [tenant.id])).rows)
    historyOn = switchOn(row?.history_enabled)
    cap = normalizeConversationCap(row?.max_messages_per_conversation)
  }
  if (!historyOn) {
    const inserted = await query(`INSERT INTO public.chat_conversations(tenant_id,phone_hash) VALUES($1,$2) RETURNING id`, [tenant.id, phoneHash])
    if (inserted.rows.length !== 1) throw new AdminMenuError(503, 'Failed to create conversation')
    // The daily allowance is per phone, whatever conversation the messages were in.
    return { conversation_id: inserted.rows[0].id, rate_limit: rateLimit, messages_today: await usedLast24h(query, tenant.id, phoneHash, now) }
  }
  const found = unique((await query(`SELECT id,message_count,started_at,last_message_at FROM public.chat_conversations
    WHERE tenant_id=$1 AND phone_hash=$2 AND started_at>=$3 ORDER BY started_at DESC LIMIT 1`, [tenant.id, phoneHash, start.toISOString()])).rows)
  // A conversation that went quiet for CHAT_IDLE_MS, or already holds its cap of guest messages, is closed: start a new one.
  const existing = found && isConversationReusable({ startedAt: found.started_at, lastMessageAt: found.last_message_at, messageCount: found.message_count, cap, now }) ? found : null
  if (existing) return { conversation_id: existing.id, rate_limit: rateLimit, messages_today: existing.message_count ?? 0 }
  const inserted = await query(`INSERT INTO public.chat_conversations(tenant_id,phone_hash) VALUES($1,$2) RETURNING id`, [tenant.id, phoneHash])
  if (inserted.rows.length !== 1) throw new AdminMenuError(503, 'Failed to create conversation')
  // A closed earlier conversation today still counts against the phone's daily allowance.
  return { conversation_id: inserted.rows[0].id, rate_limit: rateLimit, messages_today: found ? await usedLast24h(query, tenant.id, phoneHash, now) : 0 }
}
