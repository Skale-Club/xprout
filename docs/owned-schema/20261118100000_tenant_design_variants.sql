-- Per-client design variants ("site isolation", docs/product/design-variants.md).
-- Legacy counterpart: supabase/migrations/20261118100000_tenant_design_variants.sql.
--
--   tenant_settings.design_variants   { slotId: variantId } map chosen by a superadmin
--                                     for this restaurant; '{}' = every slot uses its
--                                     registry default (src/lib/design-variants.ts).
--
-- A JSON object of at most 4096 bytes. One transaction, idempotent, run by the Owned
-- schema workflow as xmartmenu_owner (docs/owned-schema/README.md). The app reads and
-- writes the column only once it exists, so deploying the code first is safe.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
DO $$ BEGIN
 IF current_database()<>'xmartmenu' OR current_user<>'xmartmenu_owner'
 OR (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database())<>'xmartmenu_owner'
 THEN RAISE EXCEPTION 'Exact owned database and owner required'; END IF;
END $$;

ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS design_variants jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.tenant_settings'::regclass AND conname='tenant_settings_design_variants_check') THEN
  ALTER TABLE public.tenant_settings ADD CONSTRAINT tenant_settings_design_variants_check
   CHECK (jsonb_typeof(design_variants)='object' AND pg_column_size(design_variants) <= 4096);
 END IF;
END $$;

GRANT SELECT, UPDATE (design_variants) ON public.tenant_settings TO xmartmenu_runtime;

-- Sentinel: the runtime can read and set the column, it defaults to '{}' and the check holds.
DO $$ BEGIN
 IF NOT has_column_privilege('xmartmenu_runtime','public.tenant_settings','design_variants','SELECT,UPDATE')
 THEN RAISE EXCEPTION 'Runtime cannot use tenant_settings.design_variants'; END IF;
 IF (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='tenant_settings' AND column_name='design_variants') IS DISTINCT FROM '''{}''::jsonb'
 THEN RAISE EXCEPTION 'design_variants must default to {}'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.tenant_settings'::regclass AND convalidated AND conname='tenant_settings_design_variants_check')
 THEN RAISE EXCEPTION 'design_variants check is missing'; END IF;
END $$;
COMMIT;
