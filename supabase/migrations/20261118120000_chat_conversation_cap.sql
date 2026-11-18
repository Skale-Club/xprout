-- Each restaurant caps how many guest messages one assistant conversation may hold
-- (default 20, range 1..200). The per-phone daily allowance stays the main credit guard;
-- this bounds a single conversation (and its prompt history) as well.
-- Owned counterpart: docs/owned-schema/20261118120000_chat_conversation_cap.sql.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
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
COMMIT;
