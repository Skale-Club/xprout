import { describe, expect, it } from 'vitest'
import { CHAT_MODELS, DEFAULT_CHAT_MODEL, chatModelLabel, isChatModel, parseChatModelSetting, resolveChatModel } from '@/lib/ai/chat-models'
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

describe('resolveChatModel with a platform default', () => {
  const [first, second, third] = CHAT_MODELS.map(model => model.value)
  it('prefers the restaurant model, then the platform default, then the code default', () => {
    expect(resolveChatModel(second, third)).toBe(second)
    expect(resolveChatModel(null, third)).toBe(third)
    expect(resolveChatModel(undefined, third)).toBe(third)
    expect(resolveChatModel(null, null)).toBe(DEFAULT_CHAT_MODEL)
    expect(resolveChatModel(undefined)).toBe(DEFAULT_CHAT_MODEL)
    expect(first).toBe(DEFAULT_CHAT_MODEL)
  })
  it('falls through retired ids on either level', () => {
    expect(resolveChatModel('openai/gpt-4o-mini', third)).toBe(third)
    expect(resolveChatModel(second, 'openai/gpt-4o-mini')).toBe(second)
    expect(resolveChatModel('openai/gpt-4o-mini', 'old/model')).toBe(DEFAULT_CHAT_MODEL)
  })
})

describe('parseChatModelSetting', () => {
  it('maps null and empty to the default, keeps offered ids and rejects the rest', () => {
    expect(parseChatModelSetting(null)).toBeNull()
    expect(parseChatModelSetting('')).toBeNull()
    expect(parseChatModelSetting(CHAT_MODELS[1].value)).toBe(CHAT_MODELS[1].value)
    for (const bad of ['openai/gpt-4o-mini', 5, undefined, {}]) expect(parseChatModelSetting(bad)).toBeUndefined()
  })
})

describe('chatModelLabel', () => {
  it('labels offered models and echoes unknown ids', () => {
    expect(chatModelLabel(CHAT_MODELS[0].value)).toBe(CHAT_MODELS[0].label)
    expect(chatModelLabel('x/y')).toBe('x/y')
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
