-- Website pages (legacy Supabase counterpart of docs/owned-schema/20261116180000_tenant_pages.sql).
-- The application only serves pages on the owned database; this keeps the development schema in step.
CREATE TABLE IF NOT EXISTS public.tenant_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT false,
  show_in_nav BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenant_pages_check CHECK (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 1 AND 60
    AND char_length(title) BETWEEN 1 AND 120 AND char_length(description) <= 300
    AND jsonb_typeof(sections) = 'array' AND jsonb_array_length(sections) <= 40)
);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_pages_tenant_slug_key ON public.tenant_pages (tenant_id, slug);
CREATE INDEX IF NOT EXISTS tenant_pages_published_idx ON public.tenant_pages (tenant_id, is_published, sort_order);

CREATE TABLE IF NOT EXISTS public.page_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  page_id UUID NOT NULL REFERENCES public.tenant_pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT page_form_submissions_check CHECK (
    char_length(name) BETWEEN 1 AND 120 AND char_length(email) BETWEEN 3 AND 254
    AND (phone IS NULL OR char_length(phone) <= 40) AND char_length(message) BETWEEN 1 AND 3000)
);
CREATE INDEX IF NOT EXISTS page_form_submissions_tenant_idx ON public.page_form_submissions (tenant_id, created_at DESC);

-- Only the server (service role) reads and writes these: no browser policy.
ALTER TABLE public.tenant_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_form_submissions ENABLE ROW LEVEL SECURITY;
