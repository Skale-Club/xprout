-- Scheduled orders and per-product minimum notice (legacy Supabase counterpart of
-- docs/owned-schema/20261116140000_scheduled_orders.sql).
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS scheduled_orders_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_notice_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_min_notice_minutes_check;
ALTER TABLE public.products ADD CONSTRAINT products_min_notice_minutes_check CHECK (min_notice_minutes BETWEEN 0 AND 10080);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ NULL;
