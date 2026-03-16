-- Migration: 030_orders_momo_bank
-- Orders cho MoMo QR + chuyển khoản, admin xác nhận thủ công

CREATE TABLE IF NOT EXISTS public.orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_code text NOT NULL UNIQUE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  program text NOT NULL,
  amount int NOT NULL,
  payment_method text CHECK (payment_method IN ('momo', 'bank_transfer', 'vnpay', 'free')),
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'confirming', 'paid', 'failed', 'refunded')),
  transaction_ref text,
  notes text,
  referral_code text,
  created_at timestamptz DEFAULT now(),
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_order_code ON public.orders(order_code);

-- Cột bổ sung cho profiles (flow thanh toán đơn giản)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bodix_program text,
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS bodix_status text,
  ADD COLUMN IF NOT EXISTS bodix_start_date date,
  ADD COLUMN IF NOT EXISTS bodix_current_day int;
