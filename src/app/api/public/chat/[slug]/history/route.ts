/**
 * GET /api/public/chat/[slug]/history?conversation_id=...
 *
 * The last HISTORY_LIMIT turns of a conversation, oldest first, as
 * [{ role, content }] so the widget can show them after a reload. Only for a
 * conversation of this tenant that is not blocked; the internal cart
 * annotation is stripped from assistant turns.
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getChatAddonStatus } from '@/lib/chat-addon'
import { HISTORY_LIMIT, historyForDisplay } from '@/lib/chat-agent'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { withApi } from '@/lib/observability/with-api'
import { adminMenusOwned, AdminMenuError } from '@/lib/data/admin-menus'
import { readOwnedPublicChatHistory } from '@/lib/data/public-chat-turns-runtime'
import { log } from '@/lib/observability/log'

export const runtime = 'nodejs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function handleGET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const rl = await rateLimit('chat-history', getClientIp(request), 30, '1 m')
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 })

  const conversationId = new URL(request.url).searchParams.get('conversation_id') ?? ''
  if (!UUID.test(conversationId)) return NextResponse.json({ error: 'Invalid conversation' }, { status: 400 })

  if (adminMenusOwned()) {
    try {
      return NextResponse.json({ messages: historyForDisplay(await readOwnedPublicChatHistory(slug, conversationId)) })
    } catch (error) {
      if (!(error instanceof AdminMenuError)) log.error('chat.history_error', { err: error })
      return NextResponse.json({ error: error instanceof AdminMenuError ? error.message : 'History unavailable' }, { status: error instanceof AdminMenuError ? error.status : 503 })
    }
  }

  const supabase = createServiceClient()
  const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', slug).eq('is_active', true).maybeSingle()
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  const status = await getChatAddonStatus(tenant.id)
  if (!status.enabled) return NextResponse.json({ error: 'Chat addon not enabled' }, { status: 403 })

  const { data: convo } = await supabase
    .from('chat_conversations')
    .select('id, tenant_id, phone_hash, status')
    .eq('id', conversationId)
    .maybeSingle()
  if (!convo || convo.tenant_id !== tenant.id) return NextResponse.json({ error: 'Invalid conversation' }, { status: 400 })
  if (convo.status === 'blocked') return NextResponse.json({ error: 'Conversation has been blocked' }, { status: 403 })
  const { data: blocked } = await supabase
    .from('chat_blocked_phones')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('phone_hash', convo.phone_hash)
    .maybeSingle()
  if (blocked) return NextResponse.json({ error: 'This number is blocked' }, { status: 403 })

  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('conversation_id', convo.id)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)
  return NextResponse.json({ messages: historyForDisplay(history ?? []) })
}

export const GET = withApi('GET /api/public/chat/[slug]/history', handleGET)
