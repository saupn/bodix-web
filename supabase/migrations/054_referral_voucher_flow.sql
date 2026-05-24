-- Migration: 054_referral_voucher_flow
-- BD-REFERRAL-VOUCHER-FLOW: bật self-referral CHỈ cho program_type='referral',
-- mở rộng schema vouchers cho voucher 100K fixed reward.
--
-- Decisions (BD-REFERRAL-VOUCHER-FLOW audit):
--  1. Self-referral: DROP check `commissions_no_self_referral` → ADD partial
--     check chặn self chỉ với affiliate (defense in depth + app layer).
--  2. Vouchers: ADD `voucher_type`, `source_commission_id`, `used_in_order_id`,
--     `valid_from`. GIỮ amount/remaining_amount/status='active'/expires_at/
--     source_type. Map status='active' = spec 'available'.
--  3. Backfill voucher_type='fixed_amount' cho voucher cũ (mọi voucher hiện có
--     đều là referral_reward 100K → đều fixed_amount).

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. BACKUP vouchers + commissions (CLAUDE.md convention, ≥ 30 ngày)
-- ────────────────────────────────────────────────────────────────────────────
-- vouchers chỉ có 0 row hiện tại nhưng vẫn backup để rollback an toàn.
CREATE TABLE IF NOT EXISTS public.vouchers_backup_20260524 AS
  SELECT * FROM public.vouchers;

CREATE TABLE IF NOT EXISTS public.commissions_backup_20260524 AS
  SELECT * FROM public.commissions;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. COMMISSIONS — partial self-referral check
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.commissions
  DROP CONSTRAINT IF EXISTS commissions_no_self_referral;

ALTER TABLE public.commissions
  ADD CONSTRAINT commissions_no_self_referral_affiliate
  CHECK (
    program_type = 'referral'
    OR beneficiary_user_id <> referee_user_id
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 3. VOUCHERS — bổ sung cột cho voucher 100K + truy nguồn
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.vouchers
  ADD COLUMN IF NOT EXISTS voucher_type TEXT
    CHECK (voucher_type IN ('fixed_amount', 'percent')),
  ADD COLUMN IF NOT EXISTS source_commission_id UUID
    REFERENCES public.commissions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS used_in_order_id BIGINT
    REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill: voucher cũ đều là referral_reward 100K → fixed_amount.
UPDATE public.vouchers
  SET voucher_type = 'fixed_amount'
  WHERE voucher_type IS NULL;

-- Verify backfill: KHÔNG còn voucher_type NULL.
DO $$
DECLARE
  null_count INT;
BEGIN
  SELECT COUNT(*) INTO null_count
    FROM public.vouchers
    WHERE voucher_type IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Voucher backfill incomplete: % rows still NULL voucher_type', null_count;
  END IF;
END $$;

-- Sau backfill, NOT NULL.
ALTER TABLE public.vouchers
  ALTER COLUMN voucher_type SET NOT NULL,
  ALTER COLUMN voucher_type SET DEFAULT 'fixed_amount';

-- Indexes cho tra cứu voucher của user (dashboard) và truy nguồn từ commission.
CREATE INDEX IF NOT EXISTS idx_vouchers_user_status
  ON public.vouchers(user_id, status);

CREATE INDEX IF NOT EXISTS idx_vouchers_source_commission
  ON public.vouchers(source_commission_id)
  WHERE source_commission_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vouchers_used_in_order
  ON public.vouchers(used_in_order_id)
  WHERE used_in_order_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. VERIFY
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Self-referral check phải chấp nhận referral
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'commissions_no_self_referral_affiliate'
  ) THEN
    RAISE EXCEPTION 'Missing constraint commissions_no_self_referral_affiliate';
  END IF;

  -- Vouchers phải có 4 cột mới
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vouchers'
      AND column_name='voucher_type'
  ) THEN
    RAISE EXCEPTION 'vouchers.voucher_type column missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vouchers'
      AND column_name='source_commission_id'
  ) THEN
    RAISE EXCEPTION 'vouchers.source_commission_id column missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vouchers'
      AND column_name='used_in_order_id'
  ) THEN
    RAISE EXCEPTION 'vouchers.used_in_order_id column missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vouchers'
      AND column_name='valid_from'
  ) THEN
    RAISE EXCEPTION 'vouchers.valid_from column missing';
  END IF;
END $$;

COMMIT;
