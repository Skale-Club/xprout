/**
 * The models a restaurant can pick for the guest AI chat (OpenRouter ids).
 * One source of truth for the admin picker, the settings writers and the chat
 * routes. Pure module: safe to import from client components.
 */
export const DEFAULT_CHAT_MODEL = 'anthropic/claude-haiku-5.5'

export const CHAT_MODELS = [
  { value: 'anthropic/claude-haiku-5.5', label: 'Claude Haiku 5.5 — fast & cheap (recommended)' },
  { value: 'openai/gpt-5.6-luna', label: 'GPT-5.6 Luna — fast & cheap' },
  { value: 'google/gemini-3.8-flash', label: 'Gemini 3.8 Flash — fast' },
  { value: 'anthropic/claude-sonnet-5.5', label: 'Claude Sonnet 5.5 — highest quality, pricier' },
] as const

export function isChatModel(value: unknown): value is string {
  return typeof value === 'string' && CHAT_MODELS.some(model => model.value === value)
}

/** The stored id when it is still offered, otherwise the default (retired ids move over without a data migration). */
export function resolveChatModel(stored: string | null | undefined): string {
  return isChatModel(stored) ? stored : DEFAULT_CHAT_MODEL
}
