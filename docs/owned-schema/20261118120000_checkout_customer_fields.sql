-- Each restaurant decides what checkout asks the guest besides the phone, which is
-- always required: the name and the receipt email are each 'required', 'optional'
-- or 'hidden' (not asked). The defaults keep today's checkout: name required,
-- email optional.
-- Legacy counterpart: supabase/migrations/20261118120000_checkout_customer_fields.sql.
--
--   tenant_settings.checkout_name_mode    'required' (default) | 'optional' | 'hidden'
--   tenant_settings.checkout_email_mode   'optional' (default) | 'required' | 'hidden'
--
-- One transaction, idempotent, run by the Owned schema workflow as
-- xmartmenu_owner (docs/owned-schema/README.md). It may run after the code deploys:
-- the readers probe information_schema and use the defaults while the columns are
-- missing (src/lib/orders/checkout-fields.ts, CHECKOUT_FIELDS_READY_SQL).
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
DO $$ BEGIN
 IF current_database()<>'xmartmenu' OR current_user<>'xmartmenu_owner'
 OR (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database())<>'xmartmenu_owner'
 THEN RAISE EXCEPTION 'Exact owned database and owner required'; END IF;
END $$;

ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS checkout_name_mode text NOT NULL DEFAULT 'required',
  ADD COLUMN IF NOT EXISTS checkout_email_mode text NOT NULL DEFAULT 'optional';

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.tenant_settings'::regclass AND conname='tenant_settings_checkout_name_mode_check') THEN
  ALTER TABLE public.tenant_settings ADD CONSTRAINT tenant_settings_checkout_name_mode_check
   CHECK (checkout_name_mode IN ('required','optional','hidden'));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.tenant_settings'::regclass AND conname='tenant_settings_checkout_email_mode_check') THEN
  ALTER TABLE public.tenant_settings ADD CONSTRAINT tenant_settings_checkout_email_mode_check
   CHECK (checkout_email_mode IN ('required','optional','hidden'));
 END IF;
END $$;

GRANT SELECT, INSERT, UPDATE (checkout_name_mode, checkout_email_mode) ON public.tenant_settings TO xmartmenu_runtime;

-- Sentinel: the runtime can read and set both columns, and they default to today's behaviour.
DO $$ BEGIN
 IF NOT has_column_privilege('xmartmenu_runtime','public.tenant_settings','checkout_name_mode','SELECT,INSERT,UPDATE')
 OR NOT has_column_privilege('xmartmenu_runtime','public.tenant_settings','checkout_email_mode','SELECT,INSERT,UPDATE')
 THEN RAISE EXCEPTION 'Runtime cannot use the checkout customer fields'; END IF;
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tenant_settings'
   AND column_name='checkout_name_mode' AND is_nullable='NO' AND column_default LIKE '''required''%')
 OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tenant_settings'
   AND column_name='checkout_email_mode' AND is_nullable='NO' AND column_default LIKE '''optional''%')
 THEN RAISE EXCEPTION 'Checkout customer fields must be NOT NULL with the default name required, email optional'; END IF;
 IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.tenant_settings'::regclass
   AND conname IN ('tenant_settings_checkout_name_mode_check','tenant_settings_checkout_email_mode_check')) <> 2
 THEN RAISE EXCEPTION 'Checkout customer fields are missing their CHECK constraints'; END IF;
END $$;
COMMIT;
