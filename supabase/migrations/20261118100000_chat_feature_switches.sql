-- Each restaurant switches the AI assistant's abilities on or off: helping guests
-- order (add/remove/change cart items), calling staff from a table link, and the
-- suggested-question chips. Default true keeps every existing assistant as before.
-- Owned counterpart: docs/owned-schema/20261118100000_chat_feature_switches.sql.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
ALTER TABLE public.chat_addon_settings
  ADD COLUMN IF NOT EXISTS ordering_help_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS staff_call_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS suggestions_enabled boolean NOT NULL DEFAULT true;
COMMIT;
