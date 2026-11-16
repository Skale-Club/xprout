-- Sales tax and promo codes for guest checkout.
-- Legacy counterpart: supabase/migrations/20261116130000_tax_and_promo_codes.sql.
--
--   tenant_settings.tax_rate_bps  one sales-tax rate per restaurant, in basis points
--                                 (0-2500 = 0-25%; 625 = 6.25%). Tips and delivery are not taxed.
--   orders.discount_cents         promo discount applied to the items subtotal.
--   orders.tax_cents              tax charged on (subtotal - discount).
--   orders.promo_code             the code text used (snapshot); at most one per order.
--   promo_codes                   a restaurant's codes: percent (1-100) or fixed (cents),
--                                 optional start/end, deactivated rather than deleted.
--
-- One transaction, idempotent, run by the Owned schema workflow as
-- xmartmenu_owner (docs/owned-schema/README.md). The app reads and writes these
-- only once they all exist, so deploying the code first is safe.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
DO $$ BEGIN
 IF current_database()<>'xmartmenu' OR current_user<>'xmartmenu_owner'
 OR (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database())<>'xmartmenu_owner'
 THEN RAISE EXCEPTION 'Exact owned database and owner required'; END IF;
END $$;

ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS tax_rate_bps integer NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_cents integer NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tax_cents integer NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS promo_code text NULL;

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  kind text NOT NULL,
  value integer NOT NULL,
  starts_at timestamptz NULL,
  ends_at timestamptz NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.tenant_settings'::regclass AND conname='tenant_settings_tax_rate_bps_check') THEN
  ALTER TABLE public.tenant_settings ADD CONSTRAINT tenant_settings_tax_rate_bps_check CHECK (tax_rate_bps BETWEEN 0 AND 2500);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.orders'::regclass AND conname='orders_discount_cents_check') THEN
  ALTER TABLE public.orders ADD CONSTRAINT orders_discount_cents_check CHECK (discount_cents >= 0);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.orders'::regclass AND conname='orders_tax_cents_check') THEN
  ALTER TABLE public.orders ADD CONSTRAINT orders_tax_cents_check CHECK (tax_cents >= 0);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.promo_codes'::regclass AND conname='promo_codes_code_check') THEN
  ALTER TABLE public.promo_codes ADD CONSTRAINT promo_codes_code_check CHECK (code = upper(code) AND code ~ '^[A-Z0-9_-]{2,32}$');
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.promo_codes'::regclass AND conname='promo_codes_value_check') THEN
  ALTER TABLE public.promo_codes ADD CONSTRAINT promo_codes_value_check CHECK (
   (kind = 'percent' AND value BETWEEN 1 AND 100) OR (kind = 'fixed' AND value BETWEEN 1 AND 10000000));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.promo_codes'::regclass AND conname='promo_codes_window_check') THEN
  ALTER TABLE public.promo_codes ADD CONSTRAINT promo_codes_window_check CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at);
 END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_tenant_code_key ON public.promo_codes (tenant_id, code);

-- Browser roles get nothing: every read and write goes through the app's server role.
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE (tax_rate_bps) ON public.tenant_settings TO xmartmenu_runtime;
GRANT SELECT, UPDATE (discount_cents, tax_cents, promo_code) ON public.orders TO xmartmenu_runtime;
GRANT SELECT, INSERT, UPDATE ON public.promo_codes TO xmartmenu_runtime;

-- Sentinel: the runtime can use every new column and table, and the rules hold.
DO $$ BEGIN
 IF NOT has_column_privilege('xmartmenu_runtime','public.tenant_settings','tax_rate_bps','SELECT,UPDATE')
 OR NOT has_column_privilege('xmartmenu_runtime','public.orders','discount_cents','SELECT,UPDATE')
 OR NOT has_column_privilege('xmartmenu_runtime','public.orders','tax_cents','SELECT,UPDATE')
 OR NOT has_column_privilege('xmartmenu_runtime','public.orders','promo_code','SELECT,UPDATE')
 OR NOT has_table_privilege('xmartmenu_runtime','public.promo_codes','SELECT,INSERT,UPDATE')
 THEN RAISE EXCEPTION 'Runtime cannot use the tax and promo code columns'; END IF;
 IF (SELECT count(*) FROM pg_constraint WHERE convalidated AND conname IN (
     'tenant_settings_tax_rate_bps_check','orders_discount_cents_check','orders_tax_cents_check',
     'promo_codes_code_check','promo_codes_value_check','promo_codes_window_check'))<>6
 THEN RAISE EXCEPTION 'Tax and promo code checks are missing'; END IF;
 IF to_regclass('public.promo_codes_tenant_code_key') IS NULL THEN RAISE EXCEPTION 'Promo code unique index is missing'; END IF;
END $$;
COMMIT;
