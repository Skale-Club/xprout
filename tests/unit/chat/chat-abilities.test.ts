import { describe, expect, it, vi } from 'vitest'
import { MockLanguageModelV3 } from 'ai/test'
import {
  assistantTurnForHistory,
  buildSystemPrompt,
  describeCart,
  historyForDisplay,
  parseCartSnapshot,
  resolveCartLineChanges,
  resolveChatAbilities,
  runChatAgent,
  type CartSnapshotItem,
  type MenuCatalog,
} from '@/lib/chat-agent'

const TABLE = '123e4567-e89b-42d3-a456-426614174000'
const cart: CartSnapshotItem[] = [
  { name: 'Pizza', quantity: 2, options: 'Size: Large', line_id: 'p1::{"Size":"L"}' },
  { name: 'Soda', quantity: 1, line_id: 's1::{}' },
  { name: 'Legacy line', quantity: 1 },
]
const catalog: MenuCatalog = { menuName: 'M', currency: 'USD', priceMultiplier: 1, categories: [], products: [] }

describe('cart snapshot line ids', () => {
  it('keeps a bounded line_id and drops an oversized or non-string one', () => {
    const out = parseCartSnapshot([
      { name: 'A', quantity: 1, line_id: 'abc' },
      { name: 'B', quantity: 1, line_id: 'x'.repeat(501) },
      { name: 'C', quantity: 1, line_id: 5 },
    ])
    expect(out[0].line_id).toBe('abc')
    expect(out[1].line_id).toBeUndefined()
    expect(out[2].line_id).toBeUndefined()
  })
  it('lists refs only for lines that can be changed', () => {
    const text = describeCart(cart, true)
    expect(text).toContain('[L1] 2× Pizza (Size: Large)')
    expect(text).toContain('[L2] 1× Soda')
    expect(text).not.toContain('[L3]')
    expect(describeCart(cart)).not.toContain('[L1]')
  })
})

describe('resolveCartLineChanges', () => {
  it('resolves a valid ref to the widget line id', () => {
    const r = resolveCartLineChanges(cart, [{ ref: 'L1', quantity: 3 }])
    expect(r.changes).toEqual([{ line_id: 'p1::{"Size":"L"}', name: 'Pizza', quantity: 3 }])
    expect(r.rejected).toEqual([])
  })
  it('accepts quantity 0 as a removal', () => {
    expect(resolveCartLineChanges(cart, [{ ref: 'l2', quantity: 0 }]).changes).toEqual([{ line_id: 's1::{}', name: 'Soda', quantity: 0 }])
  })
  it('rejects unknown refs, lines without an id and bad quantities', () => {
    const r = resolveCartLineChanges(cart, [{ ref: 'L9', quantity: 1 }, { ref: 'L3', quantity: 1 }, { ref: 'L1', quantity: -1 }, { ref: 'L1', quantity: 1.5 }])
    expect(r.changes).toEqual([])
    expect(r.rejected.map((x) => x.ref)).toEqual(['L9', 'L3', 'L1', 'L1'])
  })
  it('keeps the last request for the same line', () => {
    const r = resolveCartLineChanges(cart, [{ ref: 'L1', quantity: 2 }, { ref: 'L1', quantity: 5 }])
    expect(r.changes).toHaveLength(1)
    expect(r.changes[0].quantity).toBe(5)
  })
})

describe('resolveChatAbilities', () => {
  const base = { canAddToCart: true, waiterCalls: true, tableId: TABLE }
  it('defaults every switch to on and follows the plan first', () => {
    expect(resolveChatAbilities(base)).toEqual({ orderingHelp: true, staffCall: true })
    expect(resolveChatAbilities({ ...base, canAddToCart: false, waiterCalls: false })).toEqual({ orderingHelp: false, staffCall: false })
  })
  it('turns an ability off with the restaurant switch', () => {
    expect(resolveChatAbilities({ ...base, orderingHelpEnabled: false })).toEqual({ orderingHelp: false, staffCall: true })
    expect(resolveChatAbilities({ ...base, staffCallEnabled: false })).toEqual({ orderingHelp: true, staffCall: false })
  })
  it('needs a valid table link for staff calls', () => {
    expect(resolveChatAbilities({ ...base, tableId: null }).staffCall).toBe(false)
    expect(resolveChatAbilities({ ...base, tableId: 'not-a-uuid' }).staffCall).toBe(false)
  })
})

describe('prompt gating', () => {
  const base = { name: 'Cantina', profile: 'P', menuContext: 'M', ordering: 'O', canAddToCart: true, cart }
  it('adds the ordering and staff rules only when those abilities are on', () => {
    const on = buildSystemPrompt({ ...base, orderingHelp: true, staffCall: true })
    expect(on).toContain('Call addToCart')
    expect(on).toContain('updateCartItem')
    expect(on).toContain('[L1]')
    expect(on).toContain('callStaff')
    const off = buildSystemPrompt({ ...base, orderingHelp: false, staffCall: false })
    expect(off).not.toContain('Call addToCart')
    expect(off).not.toContain('updateCartItem')
    expect(off).not.toContain('callStaff')
    expect(off).not.toContain('[L1]')
  })
  it('tells the assistant it cannot change an existing cart when ordering help is off', () => {
    const off = buildSystemPrompt({ ...base, orderingHelp: false })
    expect(off).toContain('You cannot change the order')
    expect(off).toContain('menu screen')
  })
})

describe('tool gating', () => {
  const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } }
  const textStep = { content: [{ type: 'text' as const, text: 'ok' }], finishReason: { unified: 'stop' as const, raw: 'stop' }, usage, warnings: [] }
  const toolNames = async (extra: Partial<Parameters<typeof runChatAgent>[0]>) => {
    const model = new MockLanguageModelV3({ doGenerate: async () => textStep as never })
    await runChatAgent({ model, system: 's', messages: [{ role: 'user', content: 'hi' }], catalog, ordersEnabled: false, ...extra })
    return (model.doGenerateCalls[0].tools ?? []).map((t) => t.name).sort()
  }
  it('registers no tool when every ability is off', async () => {
    expect(await toolNames({})).toEqual([])
  })
  it('registers the cart tools only with ordering help, and callStaff only with a caller', async () => {
    expect(await toolNames({ ordersEnabled: true, cart })).toEqual(['addToCart', 'updateCartItem'])
    expect(await toolNames({ callStaff: async () => ({ ok: true }) })).toEqual(['callStaff'])
    expect(await toolNames({ ordersEnabled: true, cart, callStaff: async () => ({ ok: true }) })).toEqual(['addToCart', 'callStaff', 'updateCartItem'])
  })
  it('collects cart changes and notifies the staff once per turn', async () => {
    const call = (name: string, input: unknown, id: string) => ({ content: [{ type: 'tool-call' as const, toolCallId: id, toolName: name, input: JSON.stringify(input) }], finishReason: { unified: 'tool-calls' as const, raw: 'tool_calls' }, usage, warnings: [] })
    const steps = [call('updateCartItem', { changes: [{ ref: 'L1', quantity: 0 }] }, 'a'), call('callStaff', { reason: 'bill' }, 'b'), call('callStaff', { reason: 'waiter' }, 'c'), textStep]
    let i = 0
    const model = new MockLanguageModelV3({ doGenerate: async () => steps[i++] as never })
    const callStaff = vi.fn(async () => ({ ok: true as const }))
    const result = await runChatAgent({ model, system: 's', messages: [{ role: 'user', content: 'x' }], catalog, ordersEnabled: true, cart, callStaff })
    expect(result.cartChanges).toEqual([{ line_id: 'p1::{"Size":"L"}', name: 'Pizza', quantity: 0 }])
    expect(callStaff).toHaveBeenCalledTimes(1)
    expect(result.staffCalled).toBe('bill')
  })
})

describe('history annotations', () => {
  it('stores and strips every annotation kind', () => {
    const stored = assistantTurnForHistory('Done', [], [{ line_id: 'x', name: 'Pizza', quantity: 0 }, { line_id: 'y', name: 'Soda', quantity: 3 }], 'waiter')
    expect(stored).toContain('[Changed cart: Pizza → removed; Soda → 3×]')
    expect(stored).toContain('[Called staff: waiter]')
    expect(historyForDisplay([{ role: 'assistant', content: stored }, { role: 'user', content: 'hi' }])).toEqual([{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'Done' }])
  })
  it('strips an add and a change together and keeps plain text intact', () => {
    const item = { quantity: 1, name: 'Soda', selected_options: {}, unit_price: 5 } as never
    const stored = assistantTurnForHistory('Swapped', [item], [{ line_id: 'x', name: 'Tea', quantity: 0 }])
    expect(historyForDisplay([{ role: 'assistant', content: stored }])).toEqual([{ role: 'assistant', content: 'Swapped' }])
    expect(historyForDisplay([{ role: 'assistant', content: 'Use [brackets] freely' }])[0].content).toBe('Use [brackets] freely')
  })
})
