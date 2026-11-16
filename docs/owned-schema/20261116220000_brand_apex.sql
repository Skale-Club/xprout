-- Optional partner brand sites and company-as-tenant pages. No partner is seeded.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
DO $$ BEGIN
 IF current_database()<>'xmartmenu' OR current_user<>'xmartmenu_owner'
 OR (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database())<>'xmartmenu_owner'
 THEN RAISE EXCEPTION 'Exact owned database and owner required'; END IF;
END $$;
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
GRANT SELECT(apex_tenant_id,apex_home_slug,tenant_marketing_routes) ON public.brands TO xmartmenu_runtime;
GRANT SELECT(business_kind) ON public.tenants TO xmartmenu_runtime;
DO $$ BEGIN
 IF NOT has_column_privilege('xmartmenu_runtime','public.brands','apex_tenant_id','SELECT')
 OR NOT has_column_privilege('xmartmenu_runtime','public.tenants','business_kind','SELECT')
 OR (SELECT count(*) FROM pg_constraint WHERE convalidated AND conname IN ('brands_apex_home_slug_check','tenants_business_kind_check'))<>2
 THEN RAISE EXCEPTION 'Brand apex schema sentinel failed'; END IF;
END $$;
COMMIT;
