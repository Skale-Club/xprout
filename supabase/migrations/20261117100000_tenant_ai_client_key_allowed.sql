-- A restaurant may manage its own OpenRouter key only when a superadmin allows it
-- (owner rule 2026-11-17: the key is the platform's responsibility by default).
-- Owned counterpart: docs/owned-schema/20261117100000_tenant_ai_client_key_allowed.sql.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
ALTER TABLE public.tenant_ai_settings ADD COLUMN IF NOT EXISTS client_key_allowed boolean NOT NULL DEFAULT false;
COMMIT;
