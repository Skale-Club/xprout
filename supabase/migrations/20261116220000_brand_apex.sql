-- Optional partner brand sites and company-as-tenant pages. No partner is seeded.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS apex_tenant_id uuid NULL REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS apex_home_slug text NOT NULL DEFAULT 'home';
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS tenant_marketing_routes boolean NOT NULL DEFAULT false;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS business_kind text NOT NULL DEFAULT 'restaurant';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.brands'::regclass AND conname='brands_apex_home_slug_check') THEN
  ALTER TABLE public.brands ADD CONSTRAINT brands_apex_home_slug_check CHECK (apex_home_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(apex_home_slug)<=60);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.tenants'::regclass AND conname='tenants_business_kind_check') THEN
  ALTER TABLE public.tenants ADD CONSTRAINT tenants_business_kind_check CHECK (business_kind IN ('restaurant','software','agency'));
 END IF;
END $$;
COMMIT;
