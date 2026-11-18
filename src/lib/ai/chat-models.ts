/**
 * The models the guest AI chat can run on (OpenRouter ids). The platform team sets a global default and may
 * override it per restaurant. One source of truth for the superadmin pickers, the settings writers and the chat
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

/** The label shown for a model id (the id itself for one that is no longer offered). */
export function chatModelLabel(id: string): string {
  return CHAT_MODELS.find(model => model.value === id)?.label ?? id
}

/**
 * The model that answers a restaurant's guests: the restaurant's own (set by the platform team) when it is still
 * offered, else the platform's default model when it is still offered, else the code default. Retired ids fall
 * through without a data migration.
 */
export function resolveChatModel(tenantModel: string | null | undefined, globalModel?: string | null): string {
  if (isChatModel(tenantModel)) return tenantModel
  if (isChatModel(globalModel)) return globalModel
  return DEFAULT_CHAT_MODEL
}

/** A model setting from a panel: null/empty = follow the default; anything else must be offered. Returns undefined when invalid. */
export function parseChatModelSetting(value: unknown): string | null | undefined {
  if (value === null || value === '') return null
  return isChatModel(value) ? value : undefined
}
