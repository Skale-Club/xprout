-- Each restaurant switches the AI assistant's abilities on or off: helping guests
-- order (add/remove/change cart items), calling staff from a table link, and the
-- suggested-question chips, and whether guests' chat history is kept (off for a shared tablet). Default true keeps every existing assistant as before.
-- Legacy counterpart: supabase/migrations/20261118100000_chat_feature_switches.sql.
--
--   chat_addon_settings.ordering_help_enabled   true (default) = addToCart/updateCartItem offered
--   chat_addon_settings.staff_call_enabled      true (default) = callStaff offered on table links
--   chat_addon_settings.suggestions_enabled     true (default) = suggested-question chips shown
--   chat_addon_settings.history_enabled         true (default) = the widget keeps the guest's conversation;
--                                               false = every session starts from zero (new conversation, no history)
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
COMMIT;
