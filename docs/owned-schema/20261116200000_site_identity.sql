-- SEO site identity. Code tolerates this schema being absent; apply only at release.
-- Counterpart: supabase/migrations/20261116200000_site_identity.sql.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
DO $$ BEGIN
 IF current_database()<>'xmartmenu' OR current_user<>'xmartmenu_owner'
 OR (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database())<>'xmartmenu_owner'
 THEN RAISE EXCEPTION 'Exact owned database and owner required'; END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.brands (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
 primary_host text NOT NULL UNIQUE CHECK (primary_host = lower(primary_host) AND primary_host ~ '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$' AND char_length(primary_host) <= 253),
 extra_hosts text[] NOT NULL DEFAULT '{}',
 logo text NULL,
 icon text NULL,
 social_image text NULL,
 gtm_id text NULL CHECK (gtm_id IS NULL OR gtm_id ~ '^GTM-[A-Z0-9]+$'),
 support_email text NULL,
 privacy_url text NULL,
 terms_url text NULL,
 show_powered_by boolean NOT NULL DEFAULT true,
 default_lang text NOT NULL DEFAULT 'en' CHECK (default_lang ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brands FROM PUBLIC;
INSERT INTO public.brands (id, name, primary_host, extra_hosts, logo, icon, social_image, gtm_id, privacy_url, terms_url)
VALUES ('00000000-0000-4000-8000-000000000001', 'Xprout', 'xprout.app', ARRAY['www.xprout.app'],
 '/brand/xprout/v1/xprout-horizontal-forest.svg?v=3144b79c', '/brand/xprout/v1/icon-512.png',
 '/opengraph-image?v=411ed0a0', 'GTM-TC3X2ZM9', 'https://xprout.app/privacy', 'https://xprout.app/terms')
ON CONFLICT DO NOTHING;

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS brand_id uuid NULL REFERENCES public.brands(id);
-- Backfill only once. A rerun must never republish a tenant deliberately unpublished later.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tenants' AND column_name='published_at') THEN
  ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
  -- Existing onboarding publishes active restaurants immediately. Preserve that
  -- default; a caller can explicitly pass NULL to create an unpublished site.
  ALTER TABLE public.tenants ADD COLUMN published_at timestamptz NULL DEFAULT now();
  UPDATE public.tenants SET is_demo = is_demo OR slug IN ('aurora','bella-vista'),
   published_at = CASE WHEN is_demo OR slug IN ('aurora','bella-vista') THEN NULL ELSE created_at END;
 END IF;
END $$;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS tenants_brand_id_idx ON public.tenants(brand_id) WHERE brand_id IS NOT NULL;

GRANT SELECT ON public.brands TO xmartmenu_runtime;
GRANT SELECT (brand_id, is_demo, published_at) ON public.tenants TO xmartmenu_runtime;

DO $$ BEGIN
 IF NOT has_table_privilege('xmartmenu_runtime','public.brands','SELECT')
 OR NOT has_column_privilege('xmartmenu_runtime','public.tenants','brand_id','SELECT')
 OR NOT has_column_privilege('xmartmenu_runtime','public.tenants','is_demo','SELECT')
 OR NOT has_column_privilege('xmartmenu_runtime','public.tenants','published_at','SELECT')
 OR NOT EXISTS (SELECT 1 FROM public.brands WHERE id='00000000-0000-4000-8000-000000000001' AND primary_host='xprout.app')
 THEN RAISE EXCEPTION 'Site identity schema sentinel failed'; END IF;
END $$;
COMMIT;
