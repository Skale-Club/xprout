/**
 * Admin chat-addon settings API.
 * GET  — returns the chat settings (never the key columns)
 * PUT  — upserts them. The OpenRouter key is not set here any more: it lives
 *        in tenant_ai_settings (Settings › AI & billing, /api/admin/ai).
 */
import { NextResponse } from 'next/server'
import { getEffectiveTenant } from '@/lib/get-effective-tenant'
import { createServiceClient } from '@/lib/supabase/server'
import { getChatAddonStatus } from '@/lib/chat-addon'
import { withApi } from '@/lib/observability/with-api'
import { log } from '@/lib/observability/log'
import { MAX_MAX_MESSAGES_PER_CONVERSATION, MIN_MAX_MESSAGES_PER_CONVERSATION } from '@/lib/chat-limits'
import { adminMenusOwned } from '@/lib/data/admin-menus'
import { adminChatContext, adminChatError } from '@/lib/admin/chat-context'
import { readOwnedAdminChatSettings, writeOwnedAdminChatSettings } from '@/lib/data/admin-chat-runtime'
import { readNativeAnalyticsBody } from '@/lib/data/public-analytics'

async function handleGET() {
  const effective = await getEffectiveTenant()
  if (!effective) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (effective.role === 'store-staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (adminMenusOwned()) {
    try { return NextResponse.json(await readOwnedAdminChatSettings(await adminChatContext(effective))) }
    catch (error) { return adminChatError(error) }
  }

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('chat_addon_settings')
    .select('*')
    .eq('tenant_id', effective.tenantId)
    .maybeSingle()

  const status = await getChatAddonStatus(effective.tenantId)

  return NextResponse.json({
    settings: data
      ? {
          ...data,
          // Legacy key columns: keys live in tenant_ai_settings now.
          openrouter_api_key: undefined,
          audio_api_key: undefined,
        }
      : null,
    status,
  })
}

async function handlePUT(request: Request) {
  const effective = await getEffectiveTenant()
  if (!effective) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (effective.role === 'store-staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (adminMenusOwned()) {
    try { return NextResponse.json(await writeOwnedAdminChatSettings(await adminChatContext(effective), JSON.parse(await readNativeAnalyticsBody(request)))) }
    catch (error) { return adminChatError(error) }
  }

  const body = await request.json()
  const {
    enabled,
    audio_enabled,
    text_enabled,
    ordering_help_enabled,
    staff_call_enabled,
    suggestions_enabled,
    history_enabled,
    audio_provider,
    rate_limit_per_phone_per_day,
    max_messages_per_conversation,
  } = body as Record<string, any>

  const supabase = createServiceClient()
  const payload: Record<string, unknown> = { tenant_id: effective.tenantId, updated_at: new Date().toISOString() }
  if (typeof enabled === 'boolean') payload.enabled = enabled
  // openrouter_model is set by the platform team (superadmin), never by the restaurant: ignored here.
  if (typeof audio_enabled === 'boolean') payload.audio_enabled = audio_enabled
  if (typeof text_enabled === 'boolean') payload.text_enabled = text_enabled
  if (typeof ordering_help_enabled === 'boolean') payload.ordering_help_enabled = ordering_help_enabled
  if (typeof staff_call_enabled === 'boolean') payload.staff_call_enabled = staff_call_enabled
  if (typeof suggestions_enabled === 'boolean') payload.suggestions_enabled = suggestions_enabled
  if (typeof history_enabled === 'boolean') payload.history_enabled = history_enabled
  if (audio_provider === null || audio_provider === 'whisper' || audio_provider === 'deepgram') {
    payload.audio_provider = audio_provider
  }
  if (typeof rate_limit_per_phone_per_day === 'number') {
    payload.rate_limit_per_phone_per_day = Math.max(1, Math.min(500, Math.floor(rate_limit_per_phone_per_day)))
  }
  if (max_messages_per_conversation !== undefined && max_messages_per_conversation !== null) {
    const cap = max_messages_per_conversation
    if (typeof cap !== 'number' || !Number.isInteger(cap) || cap < MIN_MAX_MESSAGES_PER_CONVERSATION || cap > MAX_MAX_MESSAGES_PER_CONVERSATION) {
      return NextResponse.json({ error: `Messages per conversation must be a whole number from ${MIN_MAX_MESSAGES_PER_CONVERSATION} to ${MAX_MAX_MESSAGES_PER_CONVERSATION}` }, { status: 400 })
    }
    payload.max_messages_per_conversation = cap
  }

  const { error } = await supabase
    .from('chat_addon_settings')
    .upsert(payload, { onConflict: 'tenant_id' })

  if (error) {
    // The column arrives with a schema step that may run after the code deploys.
    if (payload.max_messages_per_conversation !== undefined && /max_messages_per_conversation/.test(error.message ?? '')) {
      return NextResponse.json({ error: 'Settings not available yet, try again in a few minutes' }, { status: 409 })
    }
    log.error('chat_addon_settings.upsert_error', { err: error })
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export const GET = withApi('GET /api/admin/chat-addon/settings', handleGET)
export const PUT = withApi('PUT /api/admin/chat-addon/settings', handlePUT)
