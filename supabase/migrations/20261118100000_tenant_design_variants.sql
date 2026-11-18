-- Per-client design variants (legacy Supabase counterpart of
-- docs/owned-schema/20261118100000_tenant_design_variants.sql).
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS design_variants JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.tenant_settings DROP CONSTRAINT IF EXISTS tenant_settings_design_variants_check;
ALTER TABLE public.tenant_settings ADD CONSTRAINT tenant_settings_design_variants_check
  CHECK (jsonb_typeof(design_variants) = 'object' AND pg_column_size(design_variants) <= 4096);
