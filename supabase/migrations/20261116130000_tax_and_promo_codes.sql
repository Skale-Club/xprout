-- Sales tax and promo codes for guest checkout (legacy Supabase counterpart of
-- docs/owned-schema/20261116130000_tax_and_promo_codes.sql).
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS tax_rate_bps INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.tenant_settings DROP CONSTRAINT IF EXISTS tenant_settings_tax_rate_bps_check;
ALTER TABLE public.tenant_settings ADD CONSTRAINT tenant_settings_tax_rate_bps_check CHECK (tax_rate_bps BETWEEN 0 AND 2500);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tax_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS promo_code TEXT NULL;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_discount_cents_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_discount_cents_check CHECK (discount_cents >= 0);
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_tax_cents_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_tax_cents_check CHECK (tax_cents >= 0);

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK (code = upper(code) AND code ~ '^[A-Z0-9_-]{2,32}$'),
  kind TEXT NOT NULL,
  value INTEGER NOT NULL,
  starts_at TIMESTAMPTZ NULL,
  ends_at TIMESTAMPTZ NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT promo_codes_value_check CHECK (
    (kind = 'percent' AND value BETWEEN 1 AND 100) OR (kind = 'fixed' AND value BETWEEN 1 AND 10000000)),
  CONSTRAINT promo_codes_window_check CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_tenant_code_key ON public.promo_codes (tenant_id, code);

-- Only the server (service role) reads and writes codes: no browser policy.
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
