-- DO NOT RUN AUTOMATICALLY.
-- Rollback for migration 054_referral_voucher_flow.
-- Khôi phục check `commissions_no_self_referral` (block toàn bộ self-referral)
-- và xóa cột vouchers thêm bởi 054.
--
-- ⚠️ Trước khi rollback:
--   1. Tắt traffic vào /api/checkout/create với code_type='referral' của
--      chính user (sẽ throw 23514 do check restored).
--   2. Đảm bảo không có voucher với source_commission_id IS NOT NULL trỏ tới
--      commission đang dùng. Nếu có, voucher chỉ "đứt link" (FK SET NULL khi
--      drop column), KHÔNG mất voucher.

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Safety: backup tables phải tồn tại
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vouchers_backup_20260524'
  ) THEN
    RAISE EXCEPTION 'Backup table vouchers_backup_20260524 not found; aborting rollback.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commissions_backup_20260524'
  ) THEN
    RAISE EXCEPTION 'Backup table commissions_backup_20260524 not found; aborting rollback.';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. COMMISSIONS — khôi phục check không-self-referral cho TẤT CẢ rows
-- ────────────────────────────────────────────────────────────────────────────
-- Vô hiệu hóa các row referral self-referral (beneficiary = referee) đã insert
-- sau khi migration 054 chạy. KHÔNG xóa (giữ audit), chỉ cancel.
UPDATE public.commissions
  SET status = 'cancelled',
      cancelled_at = NOW(),
      cancel_reason = 'rollback_054_self_referral_disallowed',
      status_history = status_history || jsonb_build_array(
        jsonb_build_object(
          'at', NOW(),
          'from', status,
          'to', 'cancelled',
          'reason', 'rollback_054_self_referral_disallowed'
        )
      )
  WHERE program_type = 'referral'
    AND beneficiary_user_id = referee_user_id
    AND status IN ('pending', 'payable');

-- Verify: không còn referral self-referral active
DO $$
DECLARE
  bad_count INT;
BEGIN
  SELECT COUNT(*) INTO bad_count
    FROM public.commissions
    WHERE beneficiary_user_id = referee_user_id
      AND status IN ('pending', 'payable', 'paid');
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'Cannot restore self-referral check: % active rows still self-referral', bad_count;
  END IF;
END $$;

ALTER TABLE public.commissions
  DROP CONSTRAINT IF EXISTS commissions_no_self_referral_affiliate;

ALTER TABLE public.commissions
  ADD CONSTRAINT commissions_no_self_referral
  CHECK (beneficiary_user_id <> referee_user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. VOUCHERS — drop indexes + cột mới
-- ────────────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_vouchers_user_status;
DROP INDEX IF EXISTS public.idx_vouchers_source_commission;
DROP INDEX IF EXISTS public.idx_vouchers_used_in_order;

-- Drop FK + cột. ON DELETE SET NULL trên FK đã tự bảo vệ orders/commissions.
ALTER TABLE public.vouchers
  DROP COLUMN IF EXISTS voucher_type,
  DROP COLUMN IF EXISTS source_commission_id,
  DROP COLUMN IF EXISTS used_in_order_id,
  DROP COLUMN IF EXISTS valid_from;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. VERIFY rollback
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Check cũ phải tồn tại trở lại
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'commissions_no_self_referral'
  ) THEN
    RAISE EXCEPTION 'Restore failed: commissions_no_self_referral not present';
  END IF;
  -- Check partial phải biến mất
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'commissions_no_self_referral_affiliate'
  ) THEN
    RAISE EXCEPTION 'Rollback failed: commissions_no_self_referral_affiliate still present';
  END IF;
  -- 4 cột vouchers phải biến mất
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vouchers'
      AND column_name IN ('voucher_type','source_commission_id','used_in_order_id','valid_from')
  ) THEN
    RAISE EXCEPTION 'Rollback failed: some 054 columns still present on vouchers';
  END IF;
END $$;

COMMIT;
