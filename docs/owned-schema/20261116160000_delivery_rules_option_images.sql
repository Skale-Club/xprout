-- Own-delivery rules and photos on option choices.
-- Legacy counterpart: supabase/migrations/20261116160000_delivery_rules_option_images.sql.
--
--   tenant_settings.delivery_zones_only  when true and the restaurant has active zones, an address
--                                        matching no zone cannot order delivery.
--   delivery_zones.min_order_cents       minimum items subtotal (before any promo) to deliver to the
--                                        zone; 0 = no minimum.
--   product_options.image_url            optional photo of an option choice (a URL from the shared
--                                        optimized image pipeline); NULL = none.
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

ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS delivery_zones_only boolean NOT NULL DEFAULT false;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS min_order_cents integer NOT NULL DEFAULT 0;
ALTER TABLE public.product_options ADD COLUMN IF NOT EXISTS image_url text NULL;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.delivery_zones'::regclass AND conname='delivery_zones_min_order_cents_check') THEN
  ALTER TABLE public.delivery_zones ADD CONSTRAINT delivery_zones_min_order_cents_check
   CHECK (min_order_cents >= 0 AND min_order_cents <= 1000000);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.product_options'::regclass AND conname='product_options_image_url_check') THEN
  ALTER TABLE public.product_options ADD CONSTRAINT product_options_image_url_check
   CHECK (image_url IS NULL OR (char_length(image_url) BETWEEN 1 AND 2048 AND image_url ~ '^https?://'));
 END IF;
END $$;

GRANT SELECT, UPDATE (delivery_zones_only) ON public.tenant_settings TO xmartmenu_runtime;
GRANT SELECT, UPDATE (min_order_cents) ON public.delivery_zones TO xmartmenu_runtime;
GRANT SELECT, UPDATE (image_url) ON public.product_options TO xmartmenu_runtime;

-- Sentinel: the runtime can use every new column, and the rules hold.
DO $$ BEGIN
 IF NOT has_column_privilege('xmartmenu_runtime','public.tenant_settings','delivery_zones_only','SELECT,UPDATE')
 OR NOT has_column_privilege('xmartmenu_runtime','public.delivery_zones','min_order_cents','SELECT,UPDATE')
 OR NOT has_column_privilege('xmartmenu_runtime','public.product_options','image_url','SELECT,UPDATE')
 THEN RAISE EXCEPTION 'Runtime cannot use the delivery rules and option photo columns'; END IF;
 IF (SELECT count(*) FROM pg_constraint WHERE convalidated AND conname IN
  ('delivery_zones_min_order_cents_check','product_options_image_url_check'))<>2
 THEN RAISE EXCEPTION 'Delivery rules and option photo checks are missing'; END IF;
END $$;
COMMIT;
