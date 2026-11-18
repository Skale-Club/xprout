import { NextResponse } from 'next/server'
import { resolveAiAccess, runAi } from './ai/access'
import type { KeyChoice } from './ai/billing-rules'
import { resolveChatModel } from './ai/chat-models'
import { openRouterModel, OpenRouterError, transcribeWithOpenRouter, transcriptionModelId } from './ai/openrouter'
import { assistantTurnForHistory, buildModelMessages, MAX_USER_MESSAGE_CHARS, parseCartSnapshot, resolveChatAbilities, runChatAgent, startChatAgentStream, type ChatAgentResult } from './chat-agent'
import { chatNdjsonResponse } from './chat-stream'
import { ownedStaffCaller } from './chat-staff-call'
import { hasAnyChannel, resolveChatChannels, signVoiceTranscript, verifyVoiceTranscript } from './chat-channels'
import { buildPublicChatPrompt, type PublicChatBody } from './chat-prompt'
import { voiceTokenSecret } from './crypto'
import { AdminMenuError } from './data/admin-menus'
import { ChatLimitError } from './data/public-chat-turns'
import { readOwnedPublicChatAudio, readOwnedPublicChatTurn, saveOwnedPublicChatTurn } from './data/public-chat-turns-runtime'
import { log } from './observability/log'

function rejected(error: unknown) {
  if (!(error instanceof ChatLimitError) && !(error instanceof AdminMenuError)) log.error('chat.unexpected_error', { err: error })
  const body = error instanceof ChatLimitError ? { error: error.message, limit: error.limit, used: error.used }
    : { error: error instanceof AdminMenuError ? error.message : 'Assistant temporarily unavailable' }
  return NextResponse.json(body, { status: error instanceof AdminMenuError ? error.status : 503 })
}

/** No source client; provider work starts only after the read transaction ends. */
export async function handleOwnedChatMessage(slug: string, conversationId: string, userMessage: string, body: PublicChatBody | null, stream = false) {
  try {
    const context = await readOwnedPublicChatTurn(slug, conversationId, typeof body?.menu_id === 'string' ? body.menu_id : null)
    const access = await resolveAiAccess(context.tenant.id, 'chat')
    if (!access) throw new AdminMenuError(503, 'AI assistant not configured')
    const channels = resolveChatChannels(context.configuration)
    if (!hasAnyChannel(channels)) throw new AdminMenuError(403, 'Chat is turned off')
    let voiceVerified = false
    if (channels.voice && body?.voice_token) {
      try { voiceVerified = verifyVoiceTranscript(voiceTokenSecret(), conversationId, userMessage, body.voice_token) }
      catch (error) { log.error('chat.voice_token_error', { err: error }) }
    }
    if (!channels.text && !voiceVerified) throw new AdminMenuError(403, 'This restaurant takes voice messages only')
    if (context.used >= context.limit) throw new ChatLimitError(context.limit, context.used)
    const abilities = resolveChatAbilities({ canAddToCart: context.canAddToCart, waiterCalls: context.capabilities.waiterCalls, tableId: body?.table_id,
      orderingHelpEnabled: context.configuration.ordering_help_enabled, staffCallEnabled: context.configuration.staff_call_enabled })
    const system = buildPublicChatPrompt({ tenantName: context.tenant.name, ...context, body, abilities })
    const agentParams = (choice: KeyChoice, modelId: string) => ({ model: openRouterModel(choice.apiKey, modelId, access.fetchFor(choice, modelId)), system,
      messages: buildModelMessages([...context.history].reverse(), userMessage), catalog: context.catalog, ordersEnabled: abilities.orderingHelp,
      cart: parseCartSnapshot(body?.cart), callStaff: abilities.staffCall ? ownedStaffCaller({ slug, tableId: body?.table_id, conversationId }) : undefined })
    const persist = async (result: ChatAgentResult) => {
      const persisted = await saveOwnedPublicChatTurn({ slug, tenantId: context.tenant.id, conversationId, user: userMessage,
        assistant: assistantTurnForHistory(result.text, result.cartItems, result.cartChanges ?? [], result.staffCalled ?? null), tokens: result.totalTokens, voiceVerified })
      return { text: result.text, cart_items: result.cartItems, cart_changes: (result.cartChanges ?? []).map(({ line_id, quantity }) => ({ line_id, quantity })), staff_called: result.staffCalled != null, remaining_today: persisted.remaining_today }
    }
    const modelId = resolveChatModel(context.configuration.openrouter_model, access.platformChatModel)
    if (stream) {
      let started
      try { started = await runAi(access, choice => startChatAgentStream(agentParams(choice, modelId))) }
      catch (error) {
        log.error('chat.generate_error', { err: error })
        return NextResponse.json({ error: 'Assistant temporarily unavailable' }, { status: 502 })
      }
      return chatNdjsonResponse(started, async result => { await access.settle(); return persist(result) },
        error => error instanceof AdminMenuError ? error.message : 'Assistant temporarily unavailable')
    }
    let result
    try {
      result = await runAi(access, choice => runChatAgent(agentParams(choice, modelId)))
    } catch (error) {
      log.error('chat.generate_error', { err: error })
      return NextResponse.json({ error: 'Assistant temporarily unavailable' }, { status: 502 })
    }
    return NextResponse.json(await persist(result))
  } catch (error) { return rejected(error) }
}

export async function handleOwnedChatAudio(slug: string, conversationId: string, audio: Blob) {
  try {
    const context = await readOwnedPublicChatAudio(slug, conversationId)
    const access = await resolveAiAccess(context.tenant.id, 'transcription')
    if (!access) throw new AdminMenuError(503, 'Audio not configured')
    try {
      const model = transcriptionModelId(context.configuration.audio_provider)
      const transcript = await runAi(access, choice => transcribeWithOpenRouter({ apiKey: choice.apiKey, model, audio, fetchImpl: access.fetchFor(choice, model) }))
      const text = transcript.trim().slice(0, MAX_USER_MESSAGE_CHARS)
      return NextResponse.json({ transcript: text, voice_token: text ? signVoiceTranscript(voiceTokenSecret(), conversationId, text) : null })
    } catch (error) {
      log.error('audio.transcribe_error', { err: error })
      return NextResponse.json({ error: error instanceof OpenRouterError ? 'Transcription service unavailable' : 'Transcription failed' }, { status: error instanceof OpenRouterError ? 502 : 500 })
    }
  } catch (error) { return rejected(error) }
}
