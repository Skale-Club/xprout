import { describe, expect, it } from 'vitest'
import { CHAT_MODELS, DEFAULT_CHAT_MODEL, isChatModel, resolveChatModel } from '@/lib/ai/chat-models'
import { assistantTurnForHistory, historyForDisplay, type ResolvedCartItem } from '@/lib/chat-agent'

describe('resolveChatModel', () => {
  it('keeps every offered model', () => {
    for (const model of CHAT_MODELS) expect(resolveChatModel(model.value)).toBe(model.value)
  })
  it('moves retired, empty and missing ids to the default', () => {
    for (const stored of ['openai/gpt-4o-mini', '', null, undefined]) expect(resolveChatModel(stored)).toBe(DEFAULT_CHAT_MODEL)
    expect(isChatModel('openai/gpt-4o-mini')).toBe(false)
  })
})

describe('historyForDisplay', () => {
  it('returns oldest first with the cart annotation removed', () => {
    const item = { quantity: 2, name: 'Pizza', selected_options: { a: 'Large' }, unit_price: 40 } as unknown as ResolvedCartItem
    const stored = assistantTurnForHistory('Added!', [item])
    const out = historyForDisplay([
      { role: 'assistant', content: stored },
      { role: 'user', content: 'two pizzas' },
      { role: 'system', content: 'x' },
    ])
    expect(out).toEqual([{ role: 'user', content: 'two pizzas' }, { role: 'assistant', content: 'Added!' }])
  })
  it('drops turns that were only an annotation', () => {
    const item = { quantity: 1, name: 'Soda', selected_options: {}, unit_price: 5 } as unknown as ResolvedCartItem
    expect(historyForDisplay([{ role: 'assistant', content: assistantTurnForHistory('', [item]) }])).toEqual([])
  })
})
