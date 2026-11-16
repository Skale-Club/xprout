-- Public menu action links and the "Powered by" switch.
-- Legacy counterpart: supabase/migrations/20261116120000_menu_action_links.sql.
--
--   tenant_settings.hide_platform_brand  true hides the "Powered by Xprout" line
--                                        on that restaurant's public menu.
--   tenant_settings.order_online_url     "Order online" button (DoorDash, Uber Eats,
--                                        Toast...), shown only without guest checkout.
--   tenant_settings.reservation_url      "Reserve a table" button (OpenTable, Resy...).
--
-- URLs are NULL (not set) or an https:// address of at most 500 characters.
-- One transaction, idempotent, run by the Owned schema workflow as
-- xmartmenu_owner (docs/owned-schema/README.md). The app reads and writes the
-- columns only once they exist, so deploying the code first is safe.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
DO $$ BEGIN
 IF current_database()<>'xmartmenu' OR current_user<>'xmartmenu_owner'
 OR (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database())<>'xmartmenu_owner'
 THEN RAISE EXCEPTION 'Exact owned database and owner required'; END IF;
END $$;

ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS hide_platform_brand boolean NOT NULL DEFAULT false;
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS order_online_url text NULL;
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS reservation_url text NULL;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.tenant_settings'::regclass AND conname='tenant_settings_order_online_url_check') THEN
  ALTER TABLE public.tenant_settings ADD CONSTRAINT tenant_settings_order_online_url_check
   CHECK (order_online_url IS NULL OR (order_online_url ~* '^https://[^[:space:]]+$' AND char_length(order_online_url) <= 500));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.tenant_settings'::regclass AND conname='tenant_settings_reservation_url_check') THEN
  ALTER TABLE public.tenant_settings ADD CONSTRAINT tenant_settings_reservation_url_check
   CHECK (reservation_url IS NULL OR (reservation_url ~* '^https://[^[:space:]]+$' AND char_length(reservation_url) <= 500));
 END IF;
END $$;

GRANT SELECT, UPDATE (hide_platform_brand, order_online_url, reservation_url) ON public.tenant_settings TO xmartmenu_runtime;

-- Sentinel: the runtime can read and set the columns, and both URL rules hold.
DO $$ BEGIN
 IF NOT has_column_privilege('xmartmenu_runtime','public.tenant_settings','hide_platform_brand','SELECT,UPDATE')
 OR NOT has_column_privilege('xmartmenu_runtime','public.tenant_settings','order_online_url','SELECT,UPDATE')
 OR NOT has_column_privilege('xmartmenu_runtime','public.tenant_settings','reservation_url','SELECT,UPDATE')
 THEN RAISE EXCEPTION 'Runtime cannot use the menu action link columns'; END IF;
 IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.tenant_settings'::regclass AND convalidated
     AND conname IN ('tenant_settings_order_online_url_check','tenant_settings_reservation_url_check'))<>2
 THEN RAISE EXCEPTION 'Action link URL checks are missing'; END IF;
END $$;
COMMIT;
