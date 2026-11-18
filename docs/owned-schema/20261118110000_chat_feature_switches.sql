-- Each restaurant switches the AI assistant's abilities on or off: helping guests
-- order (add/remove/change cart items), calling staff from a table link, and the
-- suggested-question chips, and whether guests' chat history is kept (off for a shared tablet). Default true keeps every existing assistant as before.
-- Legacy counterpart: supabase/migrations/20261118110000_chat_feature_switches.sql.
--
--   chat_addon_settings.ordering_help_enabled   true (default) = addToCart/updateCartItem offered
--   chat_addon_settings.staff_call_enabled      true (default) = callStaff offered on table links
--   chat_addon_settings.suggestions_enabled     true (default) = suggested-question chips shown
--   chat_addon_settings.history_enabled         true (default) = the widget keeps the guest's conversation;
--                                               false = every session starts from zero (new conversation, no history)
--
--   platform_ai_settings.chat_model             NULL (default) = the code default chat model; else an id from CHAT_MODELS
--   chat_addon_settings.openrouter_model        now nullable, no default: NULL = follow the platform default; set per
--                                               restaurant by the superadmin only. Ids not in CHAT_MODELS become NULL.
--
-- One transaction, idempotent, run by the Owned schema workflow as
-- xmartmenu_owner (docs/owned-schema/README.md). It may run after the code deploys: the
-- owned readers probe information_schema and treat a missing switch as on
-- (src/lib/data/chat-switch-columns.ts).
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
DO $$ BEGIN
 IF current_database()<>'xmartmenu' OR current_user<>'xmartmenu_owner'
 OR (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database())<>'xmartmenu_owner'
 THEN RAISE EXCEPTION 'Exact owned database and owner required'; END IF;
END $$;

ALTER TABLE public.chat_addon_settings
  ADD COLUMN IF NOT EXISTS ordering_help_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS staff_call_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS suggestions_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS history_enabled boolean NOT NULL DEFAULT true;

GRANT SELECT, INSERT, UPDATE (ordering_help_enabled, staff_call_enabled, suggestions_enabled, history_enabled) ON public.chat_addon_settings TO xmartmenu_runtime;

ALTER TABLE public.platform_ai_settings ADD COLUMN IF NOT EXISTS chat_model text;
GRANT SELECT, INSERT, UPDATE (chat_model) ON public.platform_ai_settings TO xmartmenu_runtime;

ALTER TABLE public.chat_addon_settings
  ALTER COLUMN openrouter_model DROP NOT NULL,
  ALTER COLUMN openrouter_model DROP DEFAULT;
-- The ids offered by CHAT_MODELS (src/lib/ai/chat-models.ts); anything else follows the platform default.
UPDATE public.chat_addon_settings SET openrouter_model=NULL
 WHERE openrouter_model IS NOT NULL AND openrouter_model NOT IN ('anthropic/claude-haiku-5.5','openai/gpt-5.6-luna','google/gemini-3.8-flash','anthropic/claude-sonnet-5.5');

-- Sentinel: the runtime can read and set the columns, and they default to on.
DO $$ BEGIN
 IF NOT has_column_privilege('xmartmenu_runtime','public.chat_addon_settings','ordering_help_enabled','SELECT,INSERT,UPDATE')
 OR NOT has_column_privilege('xmartmenu_runtime','public.chat_addon_settings','staff_call_enabled','SELECT,INSERT,UPDATE')
 OR NOT has_column_privilege('xmartmenu_runtime','public.chat_addon_settings','suggestions_enabled','SELECT,INSERT,UPDATE')
 OR NOT has_column_privilege('xmartmenu_runtime','public.chat_addon_settings','history_enabled','SELECT,INSERT,UPDATE')
 THEN RAISE EXCEPTION 'Runtime cannot use the chat feature switches'; END IF;
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='chat_addon_settings'
   AND column_name IN ('ordering_help_enabled','staff_call_enabled','suggestions_enabled','history_enabled') AND column_default IS DISTINCT FROM 'true')
 THEN RAISE EXCEPTION 'chat feature switches must default to true'; END IF;
END $$;

-- Sentinel: the chat model columns are in their new state.
DO $$ BEGIN
 IF NOT has_column_privilege('xmartmenu_runtime','public.platform_ai_settings','chat_model','SELECT,INSERT,UPDATE')
 THEN RAISE EXCEPTION 'Runtime cannot use platform_ai_settings.chat_model'; END IF;
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='platform_ai_settings'
   AND column_name='chat_model' AND data_type='text' AND is_nullable='YES' AND column_default IS NULL)
 THEN RAISE EXCEPTION 'platform_ai_settings.chat_model must be nullable text without a default'; END IF;
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='chat_addon_settings'
   AND column_name='openrouter_model' AND is_nullable='YES' AND column_default IS NULL)
 THEN RAISE EXCEPTION 'chat_addon_settings.openrouter_model must be nullable without a default'; END IF;
 IF EXISTS (SELECT 1 FROM public.chat_addon_settings WHERE openrouter_model IS NOT NULL AND openrouter_model NOT IN ('anthropic/claude-haiku-5.5','openai/gpt-5.6-luna','google/gemini-3.8-flash','anthropic/claude-sonnet-5.5'))
 THEN RAISE EXCEPTION 'chat_addon_settings.openrouter_model holds a retired model'; END IF;
END $$;
COMMIT;
