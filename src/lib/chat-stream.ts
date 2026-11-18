/**
 * The chat's streamed reply: NDJSON, one JSON object per line.
 *
 *   {"type":"delta","text":"..."}            (zero or more)
 *   {"type":"done","text":...,"cart_items":[...],"cart_changes":[...],"staff_called":bool,"remaining_today":n}
 *   {"type":"error","error":"..."}            (instead of done)
 *
 * Opt-in: a client asks with `Accept: application/x-ndjson`; everyone else
 * (older cached widget builds) keeps getting the plain JSON response.
 * The wire format is in chat-stream-protocol.ts (also used by the widget).
 */
import type { ChatAgentResult, StartedChatStream } from './chat-agent'
import { log } from './observability/log'
import { NDJSON_CONTENT_TYPE, encodeChatEvent, type ChatDonePayload, type ChatStreamEvent } from './chat-stream-protocol'

export function wantsNdjson(request: Request): boolean {
  return (request.headers.get('accept') ?? '').toLowerCase().includes(NDJSON_CONTENT_TYPE)
}

export const ndjsonHeaders = {
  'Content-Type': `${NDJSON_CONTENT_TYPE}; charset=utf-8`,
  'Cache-Control': 'no-store, no-transform',
  'X-Accel-Buffering': 'no',
} as const

/**
 * The streaming Response for an already started turn (the model answered, so
 * nothing can fail with a plain HTTP error any more). After the last delta the
 * turn is persisted, then the done line carries the final text and what the
 * widget must apply. A customer who disconnects does not cancel the work: the
 * turn still finishes and is stored.
 */
export function chatNdjsonResponse(
  started: StartedChatStream,
  persist: (result: ChatAgentResult) => Promise<ChatDonePayload>,
  errorMessage: (error: unknown) => string = () => 'Assistant temporarily unavailable',
): Response {
  const encoder = new TextEncoder()
  let open = true
  return new Response(new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) => {
        if (!open) return
        try { controller.enqueue(encoder.encode(encodeChatEvent(event))) } catch { open = false }
      }
      try {
        for await (const text of started.textDeltas) if (text) send({ type: 'delta', text })
        send({ type: 'done', ...(await persist(started.finish())) })
      } catch (error) {
        log.error('chat.stream_error', { err: error })
        send({ type: 'error', error: errorMessage(error) })
      } finally {
        try { controller.close() } catch { /* the client is gone */ }
      }
    },
    cancel() { open = false },
  }), { headers: ndjsonHeaders })
}
