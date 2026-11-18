import { describe, expect, it, vi } from 'vitest'
import { MockLanguageModelV3 } from 'ai/test'
import { simulateReadableStream } from 'ai'
vi.mock('@/lib/observability/log', () => ({ log: { error: vi.fn(), warn: vi.fn() } }))
import { createChatEventParser, encodeChatEvent } from '@/lib/chat-stream-protocol'
import { chatNdjsonResponse, wantsNdjson } from '@/lib/chat-stream'
import { startChatAgentStream, type ChatAgentResult, type StartedChatStream } from '@/lib/chat-agent'

const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } }
const textChunks = (...texts: string[]) => [
  { type: 'stream-start', warnings: [] },
  { type: 'text-start', id: 't' },
  ...texts.map((delta) => ({ type: 'text-delta', id: 't', delta })),
  { type: 'text-end', id: 't' },
  { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage },
]
const streamModel = (chunks: unknown[]) => new MockLanguageModelV3({ doStream: async () => ({ stream: simulateReadableStream({ chunks: chunks as never }) }) })
const base = { system: 's', messages: [{ role: 'user' as const, content: 'hi' }], catalog: null, ordersEnabled: false }

describe('NDJSON protocol', () => {
  it('opts in only through the Accept header', () => {
    expect(wantsNdjson(new Request('http://x', { headers: { accept: 'application/x-ndjson, application/json;q=0.9' } }))).toBe(true)
    expect(wantsNdjson(new Request('http://x', { headers: { accept: '*/*' } }))).toBe(false)
    expect(wantsNdjson(new Request('http://x'))).toBe(false)
  })

  it('reassembles events split across chunks and ignores junk lines', () => {
    const parser = createChatEventParser()
    const wire = encodeChatEvent({ type: 'delta', text: 'Olá' }) + 'not json\n' + encodeChatEvent({ type: 'delta', text: ' mundo' }).trimEnd()
    const events = [...parser.feed(wire.slice(0, 10)), ...parser.feed(wire.slice(10, 50)), ...parser.feed(wire.slice(50))]
    expect(events).toEqual([{ type: 'delta', text: 'Olá' }])
    expect(parser.flush()).toEqual([{ type: 'delta', text: ' mundo' }])
  })
})

describe('chatNdjsonResponse', () => {
  const result: ChatAgentResult = { text: 'Hello', cartItems: [], cartChanges: [], staffCalled: null, totalTokens: 3 }
  const started = (fail = false): StartedChatStream => ({
    textDeltas: (async function* () { yield 'Hel'; yield 'lo'; if (fail) throw new Error('boom') })(),
    finish: () => result,
  })
  const done = { text: 'Hello', cart_items: [], cart_changes: [], staff_called: false, remaining_today: 7 }

  it('streams deltas, persists, then ends with one done line and the right headers', async () => {
    const order: string[] = []
    const response = chatNdjsonResponse(started(), async () => { order.push('persist'); return done })
    expect(response.headers.get('content-type')).toBe('application/x-ndjson; charset=utf-8')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-accel-buffering')).toBe('no')
    const events = createChatEventParser().feed(await response.text())
    expect(events).toEqual([{ type: 'delta', text: 'Hel' }, { type: 'delta', text: 'lo' }, { type: 'done', ...done }])
    expect(order).toEqual(['persist'])
  })

  it('ends with an error line (and persists nothing) when the stream breaks', async () => {
    const persist = vi.fn()
    const events = createChatEventParser().feed(await chatNdjsonResponse(started(true), persist).text())
    expect(events.at(-1)).toEqual({ type: 'error', error: 'Assistant temporarily unavailable' })
    expect(events.filter((e) => e.type === 'done')).toHaveLength(0)
    expect(persist).not.toHaveBeenCalled()
  })

  it('still persists when the client disconnects mid-stream', async () => {
    const persist = vi.fn(async () => done)
    const response = chatNdjsonResponse(started(), persist)
    const reader = response.body!.getReader()
    await reader.read()
    await reader.cancel()
    await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(1))
  })
})

describe('startChatAgentStream', () => {
  it('streams the text and finishes with the full reply and token count', async () => {
    const started = await startChatAgentStream({ ...base, model: streamModel(textChunks('Olá, ', 'tudo bem?')) })
    const parts: string[] = []
    for await (const t of started.textDeltas) parts.push(t)
    expect(parts.join('')).toBe('Olá, tudo bem?')
    expect(started.finish()).toMatchObject({ text: 'Olá, tudo bem?', cartItems: [], staffCalled: null, totalTokens: 15 })
  })

  it('rejects before any delta when the call fails first, so runAi can retry on another key', async () => {
    const model = new MockLanguageModelV3({ doStream: async () => { throw Object.assign(new Error('no credit'), { statusCode: 402 }) } })
    await expect(startChatAgentStream({ ...base, model })).rejects.toMatchObject({ statusCode: 402 })
  })
  it('streams, returns and stores one text across steps (text, tool call, text)', async () => {
    const step1 = [
      { type: 'stream-start', warnings: [] },
      { type: 'text-start', id: 'a' },
      { type: 'text-delta', id: 'a', delta: 'One moment.' },
      { type: 'text-end', id: 'a' },
      { type: 'tool-call', toolCallId: 'c1', toolName: 'callStaff', input: JSON.stringify({ reason: 'bill' }) },
      { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage },
    ]
    const steps = [step1, textChunks('The staff ', 'is coming.')]
    let n = 0
    const model = new MockLanguageModelV3({ doStream: async () => ({ stream: simulateReadableStream({ chunks: steps[n++] as never }) }) })
    const started = await startChatAgentStream({ ...base, model, callStaff: async () => ({ ok: true as const }) })
    let seen = ''
    for await (const t of started.textDeltas) seen += t
    const result = started.finish()
    expect(seen.trim()).toBe('One moment.\nThe staff is coming.')
    expect(result.text).toBe(seen.trim())
    expect(result.staffCalled).toBe('bill')
  })
})
