/**
 * Public chat session endpoint (verified-phone gate).
 *
 * The guest must be signed in with a phone confirmed by an SMS code: the phone
 * is read from the session (getVerifiedGuestPhone), never from the request, hashed
 * scoped to the tenant, and mapped to an existing (not idle, not full) or newly
 * created conversation_id. Refuses if the phone is in chat_blocked_phones.
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { hashPhone } from '@/lib/crypto'
import { countMessagesLast24h, getChatAddonStatus } from '@/lib/chat-addon'
import { withApi } from '@/lib/observability/with-api'
import { log } from '@/lib/observability/log'
import { adminMenusOwned, AdminMenuError } from '@/lib/data/admin-menus'
import { createOwnedPublicChatSession } from '@/lib/data/public-chat-session-runtime'
import { chatErrorBody, PhoneVerificationError } from '@/lib/data/public-chat-errors'
import { getVerifiedGuestPhone } from '@/lib/auth/verified-guest-phone'
import { DEFAULT_MAX_MESSAGES_PER_CONVERSATION, isConversationReusable, normalizeConversationCap } from '@/lib/chat-limits'

export const runtime = 'nodejs'

function validatePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 15
}

async function handlePOST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const phone = await getVerifiedGuestPhone().catch(() => null)
  if (!phone) return NextResponse.json(chatErrorBody(new PhoneVerificationError()), { status: 401 })
  if (adminMenusOwned()) {
    try {
      return NextResponse.json(await createOwnedPublicChatSession(slug, phone))
    } catch (error) {
      if (!(error instanceof AdminMenuError)) log.error('chat.session_error', { err: error })
      return NextResponse.json(error instanceof AdminMenuError ? chatErrorBody(error) : { error: 'Failed to create conversation' }, { status: error instanceof AdminMenuError ? error.status : 503 })
    }
  }
  if (!validatePhone(phone)) {
    return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const status = await getChatAddonStatus(tenant.id)
  if (!status.enabled) return NextResponse.json({ error: 'Chat addon not enabled' }, { status: 403 })

  const phoneHash = hashPhone(phone.replace(/\D/g, ''), tenant.id)

  // Blocklist check
  const { data: blocked } = await supabase
    .from('chat_blocked_phones')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('phone_hash', phoneHash)
    .maybeSingle()
  if (blocked) {
    return NextResponse.json({ error: 'This number is not allowed to use the assistant' }, { status: 403 })
  }

  // Addon settings: the daily allowance, and whether the guest's conversation is kept.
  // history_enabled off (a shared tablet) = every session starts from zero.
  const settingsRead = await supabase
    .from('chat_addon_settings')
    .select('rate_limit_per_phone_per_day, history_enabled, max_messages_per_conversation')
    .eq('tenant_id', tenant.id)
    .maybeSingle()
  // The column may not exist yet: read what always exists and keep history on.
  const settings = settingsRead.error
    ? (await supabase.from('chat_addon_settings').select('rate_limit_per_phone_per_day').eq('tenant_id', tenant.id).maybeSingle()).data
    : settingsRead.data
  const keepHistory = (settings as { history_enabled?: boolean | null } | null)?.history_enabled !== false
  const cap = normalizeConversationCap((settings as { max_messages_per_conversation?: number | null } | null)?.max_messages_per_conversation ?? DEFAULT_MAX_MESSAGES_PER_CONVERSATION)

  // One conversation per phone per UTC day (a new one every session when history is off)
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)

  const { data: existing } = keepHistory
    ? await supabase
      .from('chat_conversations')
      .select('id, message_count, started_at, last_message_at')
      .eq('tenant_id', tenant.id)
      .eq('phone_hash', phoneHash)
      .gte('started_at', startOfDay.toISOString())
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    : { data: null }

  // A conversation quiet for CHAT_IDLE_MS, or already holding its cap of guest messages, is closed: start a new one.
  const reusable = existing && isConversationReusable({ startedAt: existing.started_at, lastMessageAt: existing.last_message_at, messageCount: existing.message_count, cap }) ? existing : null
  let conversationId = reusable?.id ?? null
  if (!conversationId) {
    const { data: inserted, error } = await supabase
      .from('chat_conversations')
      .insert({ tenant_id: tenant.id, phone_hash: phoneHash })
      .select('id')
      .single()
    if (error || !inserted) {
      log.error('chat_conversations.insert_error', { err: error })
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
    }
    conversationId = inserted.id
  }

  return NextResponse.json({
    conversation_id: conversationId,
    rate_limit: settings?.rate_limit_per_phone_per_day ?? 30,
    // Without history the new conversation is empty, but the allowance is per phone.
    messages_today: keepHistory && reusable ? reusable.message_count ?? 0 : await countMessagesLast24h(supabase, tenant.id, phoneHash),
  })
}

export const POST = withApi('POST /api/public/chat/[slug]/session', handlePOST)
