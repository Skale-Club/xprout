import { createServiceClient } from '@/lib/supabase/server'

export { SETTINGS_NOT_AVAILABLE_YET } from '@/lib/data/platform-chat-model'

/** Legacy (Supabase) counterpart of the owned probe: does platform_ai_settings.chat_model exist yet? Selecting it errors while it does not. */
export async function legacyChatModelColumnExists(): Promise<boolean> {
  const { error } = await createServiceClient().from('platform_ai_settings').select('chat_model').limit(1)
  return !error
}
