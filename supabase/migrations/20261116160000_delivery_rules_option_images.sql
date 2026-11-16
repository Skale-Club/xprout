-- Own-delivery rules and photos on option choices
-- legacy Supabase counterpart of docs/owned-schema/20261116160000_delivery_rules_option_images.sql.
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS delivery_zones_only BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS min_order_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.product_options ADD COLUMN IF NOT EXISTS image_url TEXT NULL;

ALTER TABLE public.delivery_zones DROP CONSTRAINT IF EXISTS delivery_zones_min_order_cents_check;
ALTER TABLE public.delivery_zones ADD CONSTRAINT delivery_zones_min_order_cents_check
  CHECK (min_order_cents >= 0 AND min_order_cents <= 1000000);

ALTER TABLE public.product_options DROP CONSTRAINT IF EXISTS product_options_image_url_check;
ALTER TABLE public.product_options ADD CONSTRAINT product_options_image_url_check
  CHECK (image_url IS NULL OR (char_length(image_url) BETWEEN 1 AND 2048 AND image_url ~ '^https?://'));
