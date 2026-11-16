-- Scheduled orders and per-product minimum notice for guest checkout.
-- Legacy counterpart: supabase/migrations/20261116140000_scheduled_orders.sql.
--
--   tenant_settings.scheduled_orders_enabled  guests may pick "Schedule for later" at checkout.
--   products.min_notice_minutes               notice a dish needs (0-10080 = up to 7 days); 0 = none.
--   orders.scheduled_for                      the time the guest asked for; NULL = as soon as possible.
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

ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS scheduled_orders_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_notice_minutes integer NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS scheduled_for timestamptz NULL;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.products'::regclass AND conname='products_min_notice_minutes_check') THEN
  ALTER TABLE public.products ADD CONSTRAINT products_min_notice_minutes_check CHECK (min_notice_minutes BETWEEN 0 AND 10080);
 END IF;
END $$;

GRANT SELECT, UPDATE (scheduled_orders_enabled) ON public.tenant_settings TO xmartmenu_runtime;
GRANT SELECT, UPDATE (min_notice_minutes) ON public.products TO xmartmenu_runtime;
GRANT SELECT, UPDATE (scheduled_for) ON public.orders TO xmartmenu_runtime;

-- Sentinel: the runtime can use every new column, and the rule holds.
DO $$ BEGIN
 IF NOT has_column_privilege('xmartmenu_runtime','public.tenant_settings','scheduled_orders_enabled','SELECT,UPDATE')
 OR NOT has_column_privilege('xmartmenu_runtime','public.products','min_notice_minutes','SELECT,UPDATE')
 OR NOT has_column_privilege('xmartmenu_runtime','public.orders','scheduled_for','SELECT,UPDATE')
 THEN RAISE EXCEPTION 'Runtime cannot use the scheduled order columns'; END IF;
 IF (SELECT count(*) FROM pg_constraint WHERE convalidated AND conname='products_min_notice_minutes_check')<>1
 THEN RAISE EXCEPTION 'Minimum notice check is missing'; END IF;
END $$;
COMMIT;
