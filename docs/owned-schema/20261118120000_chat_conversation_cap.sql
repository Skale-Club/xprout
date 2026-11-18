-- Each restaurant caps how many guest messages one assistant conversation may hold
-- (default 20, range 1..200). The per-phone daily allowance stays the main credit guard;
-- this bounds a single conversation (and its prompt history) as well.
-- Legacy counterpart: supabase/migrations/20261118120000_chat_conversation_cap.sql.
--
--   chat_addon_settings.max_messages_per_conversation   integer NOT NULL DEFAULT 20, CHECK 1..200
--
-- One transaction, idempotent, run by the Owned schema workflow as
-- xmartmenu_owner (docs/owned-schema/README.md). It may run after the code deploys: the
-- owned readers probe information_schema and treat a missing column as the default
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
  ADD COLUMN IF NOT EXISTS max_messages_per_conversation integer NOT NULL DEFAULT 20;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chat_addon_settings_max_messages_per_conversation_check'
   AND conrelid='public.chat_addon_settings'::regclass) THEN
  ALTER TABLE public.chat_addon_settings
    ADD CONSTRAINT chat_addon_settings_max_messages_per_conversation_check
    CHECK (max_messages_per_conversation BETWEEN 1 AND 200);
 END IF;
END $$;

GRANT SELECT, INSERT, UPDATE (max_messages_per_conversation) ON public.chat_addon_settings TO xmartmenu_runtime;

-- Sentinel: the runtime can read and set the column, it defaults to 20 and is bounded 1..200.
DO $$ BEGIN
 IF NOT has_column_privilege('xmartmenu_runtime','public.chat_addon_settings','max_messages_per_conversation','SELECT,INSERT,UPDATE')
 THEN RAISE EXCEPTION 'Runtime cannot use chat_addon_settings.max_messages_per_conversation'; END IF;
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='chat_addon_settings'
   AND column_name='max_messages_per_conversation' AND data_type='integer' AND is_nullable='NO' AND column_default='20')
 THEN RAISE EXCEPTION 'chat_addon_settings.max_messages_per_conversation must be integer NOT NULL DEFAULT 20'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chat_addon_settings_max_messages_per_conversation_check'
   AND conrelid='public.chat_addon_settings'::regclass)
 THEN RAISE EXCEPTION 'chat_addon_settings.max_messages_per_conversation needs its 1..200 check'; END IF;
END $$;
COMMIT;
