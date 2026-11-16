-- Order contact (receipt email, language, marketing opt-ins, email idempotency stamps)
-- legacy Supabase counterpart of docs/owned-schema/20261116150000_order_contact_and_tickets.sql.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_email TEXT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_language TEXT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_email_sent_at TIMESTAMPTZ NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS ready_email_sent_at TIMESTAMPTZ NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS marketing_sms_opt_in BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS marketing_email_opt_in BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_customer_email_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_customer_email_check
  CHECK (customer_email IS NULL OR (char_length(customer_email) <= 254 AND customer_email = lower(customer_email) AND customer_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_customer_language_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_customer_language_check
  CHECK (customer_language IS NULL OR customer_language ~ '^[a-z]{2}(-[A-Z]{2})?$');
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_marketing_opt_in_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_marketing_opt_in_check
  CHECK ((NOT marketing_email_opt_in OR customer_email IS NOT NULL) AND (NOT marketing_sms_opt_in OR char_length(customer_phone) > 0));
