/**
 * The chat's streamed reply: NDJSON, one JSON object per line.
 *
 *   {"type":"delta","text":"..."}            (zero or more)
 *   {"type":"done","text":...,"cart_items":[...],"cart_changes":[...],"staff_called":bool,"remaining_today":n}
 *   {"type":"error","error":"..."}            (instead of done)
 *
 * Opt-in: a client asks with `Accept: application/x-ndjson`; everyone else
 * (older cached widget builds) keeps getting the plain JSON response.
 * Pure and client-safe (no server imports): used by the widget and the server.
 */
export const NDJSON_CONTENT_TYPE = 'application/x-ndjson'

export interface ChatDonePayload {
  text: string
  cart_items: unknown[]
  cart_changes: Array<{ line_id: string; quantity: number }>
  staff_called: boolean
  remaining_today: number
}

export type ChatStreamEvent =
  | { type: 'delta'; text: string }
  | ({ type: 'done' } & ChatDonePayload)
  | { type: 'error'; error: string }

export const encodeChatEvent = (event: ChatStreamEvent): string => `${JSON.stringify(event)}\n`

/** Incremental line parser for the client: feed it text chunks, get complete events back. */
export function createChatEventParser() {
  let buffer = ''
  const parse = (line: string): ChatStreamEvent | null => {
    if (!line.trim()) return null
    try {
      const value = JSON.parse(line) as { type?: unknown }
      return value && (value.type === 'delta' || value.type === 'done' || value.type === 'error') ? (value as ChatStreamEvent) : null
    } catch { return null }
  }
  return {
    feed(chunk: string): ChatStreamEvent[] {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      return lines.map(parse).filter((e): e is ChatStreamEvent => e !== null)
    },
    /** A last line the server did not end with a newline. */
    flush(): ChatStreamEvent[] {
      const last = parse(buffer)
      buffer = ''
      return last ? [last] : []
    },
  }
}
