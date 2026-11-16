-- Simple loyalty program: points earned on completed orders, one reward to redeem.
-- Legacy counterpart: supabase/migrations/20261116170000_loyalty.sql.
--
--   tenant_settings.loyalty_enabled         master switch (default off).
--   tenant_settings.loyalty_cents_per_point spend (cents) that earns 1 point, 100..100000.
--   tenant_settings.loyalty_reward_points   points the reward costs, 1..100000.
--   tenant_settings.loyalty_reward_cents    discount (cents) the reward gives, 1..1000000.
--   orders.loyalty_points_redeemed          points spent on this order (the discount sits in discount_cents).
--   loyalty_ledger                          one row per earn/redeem/reverse/refund; balance = SUM(points)
--                                           per tenant + customer. The unique (order_id, kind) index makes
--                                           every hook idempotent.
--
-- One transaction, idempotent, run by the Owned schema workflow as
-- xmartmenu_owner (docs/owned-schema/README.md). The app reads and writes these
-- only once they exist, so deploying the code first is safe.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
DO $$ BEGIN
 IF current_database()<>'xmartmenu' OR current_user<>'xmartmenu_owner'
 OR (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database())<>'xmartmenu_owner'
 THEN RAISE EXCEPTION 'Exact owned database and owner required'; END IF;
END $$;

ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS loyalty_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS loyalty_cents_per_point integer NOT NULL DEFAULT 500;
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS loyalty_reward_points integer NOT NULL DEFAULT 20;
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS loyalty_reward_cents integer NOT NULL DEFAULT 1000;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS loyalty_points_redeemed integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.loyalty_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  order_id uuid NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  kind text NOT NULL,
  points integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.tenant_settings'::regclass AND conname='tenant_settings_loyalty_check') THEN
  ALTER TABLE public.tenant_settings ADD CONSTRAINT tenant_settings_loyalty_check CHECK (
   loyalty_cents_per_point BETWEEN 100 AND 100000 AND loyalty_reward_points BETWEEN 1 AND 100000 AND loyalty_reward_cents BETWEEN 1 AND 1000000);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.orders'::regclass AND conname='orders_loyalty_points_redeemed_check') THEN
  ALTER TABLE public.orders ADD CONSTRAINT orders_loyalty_points_redeemed_check CHECK (loyalty_points_redeemed >= 0);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.loyalty_ledger'::regclass AND conname='loyalty_ledger_kind_check') THEN
  ALTER TABLE public.loyalty_ledger ADD CONSTRAINT loyalty_ledger_kind_check CHECK (
   (kind = 'earn' AND points > 0) OR (kind = 'refund' AND points > 0) OR (kind = 'redeem' AND points < 0) OR (kind = 'reverse' AND points < 0));
 END IF;
END $$;

-- Every hook (earn, redeem, reverse, refund) runs once per order.
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_ledger_order_kind_key ON public.loyalty_ledger (order_id, kind) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS loyalty_ledger_customer_idx ON public.loyalty_ledger (tenant_id, customer_id);

-- Browser roles get nothing: every read and write goes through the app's server role.
ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE (loyalty_enabled, loyalty_cents_per_point, loyalty_reward_points, loyalty_reward_cents) ON public.tenant_settings TO xmartmenu_runtime;
GRANT SELECT, UPDATE (loyalty_points_redeemed) ON public.orders TO xmartmenu_runtime;
GRANT SELECT, INSERT ON public.loyalty_ledger TO xmartmenu_runtime;

-- Sentinel: the runtime can use every new column and table, and the rules hold.
DO $$ BEGIN
 IF NOT has_column_privilege('xmartmenu_runtime','public.tenant_settings','loyalty_enabled','SELECT,UPDATE')
 OR NOT has_column_privilege('xmartmenu_runtime','public.tenant_settings','loyalty_cents_per_point','SELECT,UPDATE')
 OR NOT has_column_privilege('xmartmenu_runtime','public.tenant_settings','loyalty_reward_points','SELECT,UPDATE')
 OR NOT has_column_privilege('xmartmenu_runtime','public.tenant_settings','loyalty_reward_cents','SELECT,UPDATE')
 OR NOT has_column_privilege('xmartmenu_runtime','public.orders','loyalty_points_redeemed','SELECT,UPDATE')
 OR NOT has_table_privilege('xmartmenu_runtime','public.loyalty_ledger','SELECT,INSERT')
 THEN RAISE EXCEPTION 'Runtime cannot use the loyalty columns and ledger'; END IF;
 IF (SELECT count(*) FROM pg_constraint WHERE convalidated AND conname IN
  ('tenant_settings_loyalty_check','orders_loyalty_points_redeemed_check','loyalty_ledger_kind_check'))<>3
 THEN RAISE EXCEPTION 'Loyalty checks are missing'; END IF;
 IF to_regclass('public.loyalty_ledger_order_kind_key') IS NULL THEN RAISE EXCEPTION 'Loyalty ledger unique index is missing'; END IF;
END $$;
COMMIT;
