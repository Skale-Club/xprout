-- A restaurant may manage its own OpenRouter key only when a superadmin allows it
-- (owner rule 2026-11-17: the key is the platform's responsibility by default).
-- Legacy counterpart: supabase/migrations/20261117100000_tenant_ai_client_key_allowed.sql.
--
--   tenant_ai_settings.client_key_allowed   false (default) = only a superadmin sets,
--                                           changes or removes the client's key.
--
-- One transaction, idempotent, run by the Owned schema workflow as
-- xmartmenu_owner (docs/owned-schema/README.md). The app reads the column through
-- to_jsonb, so deploying the code first is safe (absent = not allowed).
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
DO $$ BEGIN
 IF current_database()<>'xmartmenu' OR current_user<>'xmartmenu_owner'
 OR (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database())<>'xmartmenu_owner'
 THEN RAISE EXCEPTION 'Exact owned database and owner required'; END IF;
END $$;

ALTER TABLE public.tenant_ai_settings ADD COLUMN IF NOT EXISTS client_key_allowed boolean NOT NULL DEFAULT false;

GRANT SELECT, INSERT, UPDATE (client_key_allowed) ON public.tenant_ai_settings TO xmartmenu_runtime;

-- Sentinel: the runtime can read and set the column, and it defaults to not allowed.
DO $$ BEGIN
 IF NOT has_column_privilege('xmartmenu_runtime','public.tenant_ai_settings','client_key_allowed','SELECT,INSERT,UPDATE')
 THEN RAISE EXCEPTION 'Runtime cannot use tenant_ai_settings.client_key_allowed'; END IF;
 IF (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='tenant_ai_settings' AND column_name='client_key_allowed') IS DISTINCT FROM 'false'
 THEN RAISE EXCEPTION 'client_key_allowed must default to false'; END IF;
END $$;
COMMIT;
