-- Each restaurant switches the AI assistant's abilities on or off: helping guests
-- order (add/remove/change cart items), calling staff from a table link, and the
-- suggested-question chips, and whether guests' chat history is kept (off for a shared tablet). Default true keeps every existing assistant as before.
--
-- Chat model: the platform has a default (platform_ai_settings.chat_model, NULL = the code default) and may set a
-- model per restaurant (chat_addon_settings.openrouter_model, NULL = follow the default). Restaurants no longer
-- choose it. Every row holding an id that is not offered any more becomes NULL, so it follows the default.
-- Owned counterpart: docs/owned-schema/20261118100000_chat_feature_switches.sql.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
ALTER TABLE public.chat_addon_settings
  ADD COLUMN IF NOT EXISTS ordering_help_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS staff_call_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS suggestions_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS history_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.platform_ai_settings ADD COLUMN IF NOT EXISTS chat_model text;
ALTER TABLE public.chat_addon_settings
  ALTER COLUMN openrouter_model DROP NOT NULL,
  ALTER COLUMN openrouter_model DROP DEFAULT;
-- The ids offered by CHAT_MODELS (src/lib/ai/chat-models.ts).
UPDATE public.chat_addon_settings SET openrouter_model=NULL
 WHERE openrouter_model IS NOT NULL AND openrouter_model NOT IN ('anthropic/claude-haiku-5.5','openai/gpt-5.6-luna','google/gemini-3.8-flash','anthropic/claude-sonnet-5.5');
COMMIT;
