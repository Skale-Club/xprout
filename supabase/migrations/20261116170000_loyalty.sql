-- Simple loyalty program (legacy Supabase counterpart of
-- docs/owned-schema/20261116170000_loyalty.sql). The application only uses loyalty
-- on the owned database; this keeps the development schema in step.
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS loyalty_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS loyalty_cents_per_point INTEGER NOT NULL DEFAULT 500;
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS loyalty_reward_points INTEGER NOT NULL DEFAULT 20;
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS loyalty_reward_cents INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE public.tenant_settings DROP CONSTRAINT IF EXISTS tenant_settings_loyalty_check;
ALTER TABLE public.tenant_settings ADD CONSTRAINT tenant_settings_loyalty_check CHECK (
  loyalty_cents_per_point BETWEEN 100 AND 100000 AND loyalty_reward_points BETWEEN 1 AND 100000 AND loyalty_reward_cents BETWEEN 1 AND 1000000);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS loyalty_points_redeemed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_loyalty_points_redeemed_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_loyalty_points_redeemed_check CHECK (loyalty_points_redeemed >= 0);

CREATE TABLE IF NOT EXISTS public.loyalty_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  order_id UUID NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  points INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT loyalty_ledger_kind_check CHECK (
    (kind = 'earn' AND points > 0) OR (kind = 'refund' AND points > 0) OR (kind = 'redeem' AND points < 0) OR (kind = 'reverse' AND points < 0))
);
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_ledger_order_kind_key ON public.loyalty_ledger (order_id, kind) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS loyalty_ledger_customer_idx ON public.loyalty_ledger (tenant_id, customer_id);

-- Only the server (service role) reads and writes the ledger: no browser policy.
ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;
