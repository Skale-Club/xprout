-- Development counterpart of docs/owned-schema/20261116210000_local_seo.sql.
-- Existing RLS remains authoritative; no browser-role mutation grants.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
DO $$ BEGIN
 IF current_database()='xmartmenu' THEN RAISE EXCEPTION 'Use the owned local SEO schema step on the owned database'; END IF;
END $$;

ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS google_business_url text NULL;
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS google_review_url text NULL;
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS facebook text NULL;
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS tripadvisor text NULL;
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS yelp text NULL;
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS accepts_reservations boolean NULL;
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS special_hours jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS google_site_verification text NULL;
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS bing_site_verification text NULL;

DO $$ DECLARE field text; BEGIN
 FOREACH field IN ARRAY ARRAY['google_business_url','google_review_url','facebook','tripadvisor','yelp'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.tenant_settings'::regclass AND conname='tenant_settings_'||field||'_check') THEN
   EXECUTE format('ALTER TABLE public.tenant_settings ADD CONSTRAINT %I CHECK (%I IS NULL OR (%I ~* %L AND char_length(%I)<=500))',
    'tenant_settings_'||field||'_check', field, field, '^https://[^[:space:]]+$', field);
  END IF;
 END LOOP;
 FOREACH field IN ARRAY ARRAY['google_site_verification','bing_site_verification'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.tenant_settings'::regclass AND conname='tenant_settings_'||field||'_check') THEN
   EXECUTE format('ALTER TABLE public.tenant_settings ADD CONSTRAINT %I CHECK (%I IS NULL OR %I ~ %L)',
    'tenant_settings_'||field||'_check', field, field, '^[a-zA-Z0-9_-]{1,256}$');
  END IF;
 END LOOP;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.tenant_settings'::regclass AND conname='tenant_settings_special_hours_check') THEN
  ALTER TABLE public.tenant_settings ADD CONSTRAINT tenant_settings_special_hours_check
   CHECK (jsonb_typeof(special_hours)='array' AND jsonb_array_length(special_hours)<=60);
 END IF;
END $$;

DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  GRANT SELECT (google_business_url, google_review_url, facebook, tripadvisor, yelp, accepts_reservations, special_hours, google_site_verification, bing_site_verification, reservation_url), INSERT (google_business_url, google_review_url, facebook, tripadvisor, yelp, accepts_reservations, special_hours, google_site_verification, bing_site_verification, reservation_url), UPDATE (google_business_url, google_review_url, facebook, tripadvisor, yelp, accepts_reservations, special_hours, google_site_verification, bing_site_verification, reservation_url) ON public.tenant_settings TO service_role;
 END IF;
END $$;
DO $$ BEGIN
 IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='tenant_settings'
  AND column_name IN ('google_business_url','google_review_url','facebook','tripadvisor','yelp','accepts_reservations','special_hours','google_site_verification','bing_site_verification'))<>9
 THEN RAISE EXCEPTION 'Local SEO columns are missing'; END IF;
 IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.tenant_settings'::regclass AND convalidated
  AND conname IN ('tenant_settings_google_business_url_check','tenant_settings_google_review_url_check','tenant_settings_facebook_check','tenant_settings_tripadvisor_check','tenant_settings_yelp_check','tenant_settings_google_site_verification_check','tenant_settings_bing_site_verification_check','tenant_settings_special_hours_check'))<>8
 THEN RAISE EXCEPTION 'Local SEO checks are missing'; END IF;
END $$;
COMMIT;
