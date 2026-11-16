-- Public menu action links and the "Powered by" switch (legacy Supabase
-- counterpart of docs/owned-schema/20261116120000_menu_action_links.sql).
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS hide_platform_brand BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS order_online_url TEXT NULL;
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS reservation_url TEXT NULL;
ALTER TABLE public.tenant_settings DROP CONSTRAINT IF EXISTS tenant_settings_order_online_url_check;
ALTER TABLE public.tenant_settings ADD CONSTRAINT tenant_settings_order_online_url_check
  CHECK (order_online_url IS NULL OR (order_online_url ~* '^https://[^[:space:]]+$' AND char_length(order_online_url) <= 500));
ALTER TABLE public.tenant_settings DROP CONSTRAINT IF EXISTS tenant_settings_reservation_url_check;
ALTER TABLE public.tenant_settings ADD CONSTRAINT tenant_settings_reservation_url_check
  CHECK (reservation_url IS NULL OR (reservation_url ~* '^https://[^[:space:]]+$' AND char_length(reservation_url) <= 500));
