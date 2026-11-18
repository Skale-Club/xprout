-- Each restaurant decides what checkout asks the guest besides the phone, which is
-- always required: the name and the receipt email are each 'required', 'optional'
-- or 'hidden' (not asked). The defaults keep today's checkout: name required,
-- email optional.
-- Owned counterpart: docs/owned-schema/20261118120000_checkout_customer_fields.sql.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
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
COMMIT;
