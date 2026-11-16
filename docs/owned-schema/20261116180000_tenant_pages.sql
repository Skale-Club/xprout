-- Website pages: each restaurant builds pages (team, story, catering, careers, FAQ...) from six
-- section types, shown at /<slug>/<page-slug> (or on its own domain at /<page-slug>).
-- Legacy counterpart: supabase/migrations/20261116180000_tenant_pages.sql.
--
--   tenant_pages            one row per page; `sections` is a JSON array the app validates with zod
--                           on every write and before rendering (invalid sections are skipped).
--   page_form_submissions   what visitors send through a page's contact form.
--
-- One transaction, idempotent, run by the Owned schema workflow as xmartmenu_owner
-- (docs/owned-schema/README.md). The app reads and writes these only once they exist, so
-- deploying the code first is safe (no pages; the admin says "available after the next update").
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
DO $$ BEGIN
 IF current_database()<>'xmartmenu' OR current_user<>'xmartmenu_owner'
 OR (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database())<>'xmartmenu_owner'
 THEN RAISE EXCEPTION 'Exact owned database and owner required'; END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tenant_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  show_in_nav boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.page_form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  page_id uuid NOT NULL REFERENCES public.tenant_pages(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.tenant_pages'::regclass AND conname='tenant_pages_check') THEN
  ALTER TABLE public.tenant_pages ADD CONSTRAINT tenant_pages_check CHECK (
   slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 1 AND 60
   AND char_length(title) BETWEEN 1 AND 120 AND char_length(description) <= 300
   AND jsonb_typeof(sections) = 'array' AND jsonb_array_length(sections) <= 40);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.page_form_submissions'::regclass AND conname='page_form_submissions_check') THEN
  ALTER TABLE public.page_form_submissions ADD CONSTRAINT page_form_submissions_check CHECK (
   char_length(name) BETWEEN 1 AND 120 AND char_length(email) BETWEEN 3 AND 254
   AND (phone IS NULL OR char_length(phone) <= 40) AND char_length(message) BETWEEN 1 AND 3000);
 END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS tenant_pages_tenant_slug_key ON public.tenant_pages (tenant_id, slug);
CREATE INDEX IF NOT EXISTS tenant_pages_published_idx ON public.tenant_pages (tenant_id, is_published, sort_order);
CREATE INDEX IF NOT EXISTS page_form_submissions_tenant_idx ON public.page_form_submissions (tenant_id, created_at DESC);

-- Browser roles get nothing: every read and write goes through the app's server role.
ALTER TABLE public.tenant_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_form_submissions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_pages TO xmartmenu_runtime;
GRANT SELECT, INSERT ON public.page_form_submissions TO xmartmenu_runtime;

-- Sentinel: the runtime can use both tables, and the rules and unique index hold.
DO $$ BEGIN
 IF NOT has_table_privilege('xmartmenu_runtime','public.tenant_pages','SELECT,INSERT,UPDATE,DELETE')
 OR NOT has_table_privilege('xmartmenu_runtime','public.page_form_submissions','SELECT,INSERT')
 THEN RAISE EXCEPTION 'Runtime cannot use the page tables'; END IF;
 IF (SELECT count(*) FROM pg_constraint WHERE convalidated AND conname IN ('tenant_pages_check','page_form_submissions_check'))<>2
 THEN RAISE EXCEPTION 'Page checks are missing'; END IF;
 IF to_regclass('public.tenant_pages_tenant_slug_key') IS NULL THEN RAISE EXCEPTION 'Page slug unique index is missing'; END IF;
END $$;
COMMIT;
