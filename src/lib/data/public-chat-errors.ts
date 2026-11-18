import { AdminMenuError } from './admin-menus'

/** The guest must be signed in with an SMS-verified phone (and it must be the conversation's phone). */
export class PhoneVerificationError extends AdminMenuError {
  readonly code = 'phone_verification_required'
  constructor() { super(401, 'Sign in with your phone to chat') }
}
/** The conversation has been quiet for CHAT_IDLE_MS. */
export class ConversationExpiredError extends AdminMenuError {
  readonly code = 'conversation_expired'
  constructor() { super(409, 'Conversation closed for inactivity') }
}
/** The conversation holds max_messages_per_conversation guest messages. */
export class ConversationLimitError extends AdminMenuError {
  readonly code = 'conversation_limit'
  constructor(public limit: number) { super(429, 'Conversation message limit reached') }
}

/** JSON body of a rejection, with the machine-readable code when the error has one. */
export function chatErrorBody(error: AdminMenuError): Record<string, unknown> {
  const { code, limit } = error as { code?: string; limit?: number }
  return { error: error.message, ...(code ? { code } : {}), ...(code === 'conversation_limit' ? { limit } : {}) }
}
