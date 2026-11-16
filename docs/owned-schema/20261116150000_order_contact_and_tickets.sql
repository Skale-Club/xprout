-- Customer contact on orders: optional receipt email, menu language, the two
-- email/SMS marketing opt-ins, and the idempotency stamps for the two customer
-- emails ("order received", "order ready"). The printable kitchen ticket needs no schema.
-- Legacy counterpart: supabase/migrations/20261116150000_order_contact_and_tickets.sql.
--
--   orders.customer_email           where the guest wants the receipt; NULL = none given.
--   orders.customer_language        menu language the guest used (menu-i18n code), for the emails.
--   orders.receipt_email_sent_at    when "order received" was claimed; NULL = not sent yet.
--   orders.ready_email_sent_at      when "order ready" was claimed; NULL = not sent yet.
--   orders.marketing_sms_opt_in     guest ticked "text me offers" (only with a phone).
--   orders.marketing_email_opt_in   guest ticked "email me offers" (only with an email).
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

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_email text NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_language text NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_email_sent_at timestamptz NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS ready_email_sent_at timestamptz NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS marketing_sms_opt_in boolean NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS marketing_email_opt_in boolean NOT NULL DEFAULT false;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.orders'::regclass AND conname='orders_customer_email_check') THEN
  ALTER TABLE public.orders ADD CONSTRAINT orders_customer_email_check
   CHECK (customer_email IS NULL OR (char_length(customer_email) <= 254 AND customer_email = lower(customer_email) AND customer_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.orders'::regclass AND conname='orders_customer_language_check') THEN
  ALTER TABLE public.orders ADD CONSTRAINT orders_customer_language_check
   CHECK (customer_language IS NULL OR customer_language ~ '^[a-z]{2}(-[A-Z]{2})?$');
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.orders'::regclass AND conname='orders_marketing_opt_in_check') THEN
  ALTER TABLE public.orders ADD CONSTRAINT orders_marketing_opt_in_check
   CHECK ((NOT marketing_email_opt_in OR customer_email IS NOT NULL) AND (NOT marketing_sms_opt_in OR char_length(customer_phone) > 0));
 END IF;
END $$;

GRANT SELECT, UPDATE (customer_email, customer_language, receipt_email_sent_at, ready_email_sent_at, marketing_sms_opt_in, marketing_email_opt_in)
 ON public.orders TO xmartmenu_runtime;

-- Sentinel: the runtime can use every new column, and the rules hold.
DO $$ BEGIN
 IF NOT has_column_privilege('xmartmenu_runtime','public.orders','customer_email','SELECT,UPDATE')
 OR NOT has_column_privilege('xmartmenu_runtime','public.orders','customer_language','SELECT,UPDATE')
 OR NOT has_column_privilege('xmartmenu_runtime','public.orders','receipt_email_sent_at','SELECT,UPDATE')
 OR NOT has_column_privilege('xmartmenu_runtime','public.orders','ready_email_sent_at','SELECT,UPDATE')
 OR NOT has_column_privilege('xmartmenu_runtime','public.orders','marketing_sms_opt_in','SELECT,UPDATE')
 OR NOT has_column_privilege('xmartmenu_runtime','public.orders','marketing_email_opt_in','SELECT,UPDATE')
 THEN RAISE EXCEPTION 'Runtime cannot use the order contact columns'; END IF;
 IF (SELECT count(*) FROM pg_constraint WHERE convalidated AND conname IN
  ('orders_customer_email_check','orders_customer_language_check','orders_marketing_opt_in_check'))<>3
 THEN RAISE EXCEPTION 'Order contact checks are missing'; END IF;
END $$;
COMMIT;
