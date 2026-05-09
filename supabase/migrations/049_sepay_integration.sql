-- Migration: 049_sepay_integration
-- SePay auto-payment: payment_code on orders + webhook event log + RPC để sinh code unique

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS payment_sequence bigint,
  ADD COLUMN IF NOT EXISTS sepay_transaction_id text,
  ADD COLUMN IF NOT EXISTS sepay_paid_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_payment_code ON public.orders(payment_code);

-- Sequence sinh số đơn liên tục, không trùng. Bắt đầu từ 100 để mã đầu là BX100.
CREATE SEQUENCE IF NOT EXISTS public.bodix_order_seq START WITH 100;

-- RPC: sinh payment code dạng BX{sequence}, atomic, không race
CREATE OR REPLACE FUNCTION public.generate_bodix_payment_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_val bigint;
BEGIN
  next_val := nextval('public.bodix_order_seq');
  IF next_val > 9999999999 THEN
    RAISE EXCEPTION 'Payment sequence exceeded 10 digits';
  END IF;
  RETURN 'BX' || next_val::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_bodix_payment_code() TO authenticated, service_role;

-- Bảng log webhook để chống duplicate + audit
CREATE TABLE IF NOT EXISTS public.sepay_webhook_events (
  id bigserial PRIMARY KEY,
  sepay_id bigint UNIQUE NOT NULL,
  reference_code text,
  transfer_type text,
  transfer_amount integer,
  account_number text,
  payment_code text,
  content text,
  matched_order_id bigint REFERENCES public.orders(id) ON DELETE SET NULL,
  status text DEFAULT 'received' CHECK (status IN ('received', 'matched', 'unmatched', 'duplicate', 'error')),
  raw_payload jsonb,
  error_message text,
  received_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sepay_events_sepay_id ON public.sepay_webhook_events(sepay_id);
CREATE INDEX IF NOT EXISTS idx_sepay_events_payment_code ON public.sepay_webhook_events(payment_code);
CREATE INDEX IF NOT EXISTS idx_sepay_events_status ON public.sepay_webhook_events(status);

-- RLS — chỉ admin xem được webhook events
ALTER TABLE public.sepay_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin can view sepay events" ON public.sepay_webhook_events;
CREATE POLICY "admin can view sepay events" ON public.sepay_webhook_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
