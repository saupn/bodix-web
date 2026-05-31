-- DO NOT RUN AUTOMATICALLY.
-- Backfill — BD-DASHBOARD-AND-REFERRAL-FIXES (Vấn đề 4.C)
--
-- Bối cảnh:
--   Trước fix, checkout/create resolve referral_codes bằng client RLS của buyer.
--   RLS = `auth.uid() = user_id` → buyer KHÔNG thấy code của người khác → rơi vào
--   legacy fallback (id=null) → enrollments.referral_code_id = NULL → SePay webhook
--   bỏ qua tạo commission. Hệ quả: đơn paid có referral_code text nhưng không có
--   commission nào (cả affiliate lẫn referral).
--
-- Script này:
--   1. Backfill enrollments.referral_code_id (+ referral_discount_amount nếu thiếu)
--      cho các đơn đã paid khớp referral_codes.code = orders.referral_code.
--   2. Tạo commission ĐÚNG LOẠI theo code_type:
--        - affiliate → reward_type='cash_commission', rate = commission_rate (vd 40%).
--        - referral  → reward_type='voucher', reward_amount = 100.000đ.
--      Logic khớp HỆT lib/affiliate/commission.ts + lib/referral/commission.ts để
--      row backfill giống y row webpook tạo về sau.
--   3. Idempotent (NOT EXISTS theo enrollment_id + program_type) + verify block.
--
-- Cách chạy: psql / Supabase SQL editor, chạy toàn bộ trong 1 transaction.
-- Backup giữ ≥ 30 ngày rồi mới drop.

BEGIN;

-- ── 0. Backup bảng bị UPDATE ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enrollments_backup_20260531 AS
  SELECT * FROM public.enrollments;

-- ── 1. Backfill enrollments.referral_code_id ──────────────────────────────
-- Chỉ với đơn đã paid, có referral_code text, và code tồn tại trong referral_codes.
UPDATE public.enrollments e
SET referral_code_id = rc.id,
    referral_discount_amount = CASE
      WHEN COALESCE(e.referral_discount_amount, 0) > 0 THEN e.referral_discount_amount
      ELSE ROUND(o.amount * 0.10)::int          -- fallback: ước lượng 10% nếu chưa lưu
    END
FROM public.orders o
JOIN public.referral_codes rc
  ON UPPER(rc.code) = UPPER(o.referral_code)
WHERE o.user_id = e.user_id
  AND o.referral_code IS NOT NULL
  AND o.payment_status = 'paid'
  AND e.referral_code_id IS NULL
  AND e.status IN ('paid_waiting_cohort', 'active', 'completed');

-- ── 2. Tạo commission cho các enrollment vừa backfill (ĐÚNG LOẠI) ─────────
-- Một enrollment ↔ một commission cho beneficiary (idempotent qua NOT EXISTS).
INSERT INTO public.commissions (
  program_type,
  beneficiary_user_id,
  beneficiary_code,
  referee_user_id,
  enrollment_id,
  order_id,
  order_amount_vnd,
  reward_type,
  reward_rate,
  reward_amount_vnd,
  reward_description,
  status,
  purchase_at,
  pending_expires_at,
  status_history
)
SELECT
  rc.code_type                                              AS program_type,
  rc.user_id                                                AS beneficiary_user_id,
  rc.code                                                   AS beneficiary_code,
  e.user_id                                                 AS referee_user_id,
  e.id                                                      AS enrollment_id,
  o.id                                                      AS order_id,
  o.amount                                                  AS order_amount_vnd,
  CASE WHEN rc.code_type = 'affiliate'
       THEN 'cash_commission' ELSE 'voucher' END            AS reward_type,
  CASE WHEN rc.code_type = 'affiliate'
       THEN COALESCE(rc.commission_rate, 40) ELSE NULL END  AS reward_rate,
  CASE WHEN rc.code_type = 'affiliate'
       THEN ROUND(o.amount * COALESCE(rc.commission_rate, 40) / 100.0)::int
       ELSE 100000 END                                      AS reward_amount_vnd,
  CASE WHEN rc.code_type = 'affiliate'
       THEN 'Commission ' || COALESCE(rc.commission_rate, 40) || '% (backfill)'
       ELSE 'Voucher 100k cho referrer (backfill)' END      AS reward_description,
  'pending'                                                 AS status,
  COALESCE(e.paid_at, o.confirmed_at, NOW())                AS purchase_at,
  COALESCE(e.paid_at, o.confirmed_at, NOW()) + INTERVAL '60 days' AS pending_expires_at,
  jsonb_build_array(jsonb_build_object(
    'at', to_char(COALESCE(e.paid_at, o.confirmed_at, NOW()) AT TIME ZONE 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'from', NULL, 'to', 'pending', 'reason', 'backfill_purchase_confirmed'
  ))                                                        AS status_history
FROM public.enrollments e
JOIN public.referral_codes rc ON rc.id = e.referral_code_id
JOIN public.orders o
  ON o.user_id = e.user_id
 AND o.payment_status = 'paid'
 AND UPPER(o.referral_code) = UPPER(rc.code)
WHERE e.referral_code_id IS NOT NULL
  -- affiliate KHÔNG cho self (beneficiary <> referee); referral cho phép self.
  AND (rc.code_type = 'referral' OR rc.user_id <> e.user_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.commissions c
    WHERE c.enrollment_id = e.id
      AND c.program_type = rc.code_type
      AND c.beneficiary_user_id = rc.user_id
  );

-- ── 3. Verify ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_enroll_linked int;
  v_commissions   int;
BEGIN
  SELECT COUNT(*) INTO v_enroll_linked
  FROM public.enrollments e
  JOIN public.orders o
    ON o.user_id = e.user_id AND o.payment_status = 'paid'
   AND o.referral_code IS NOT NULL
  WHERE e.referral_code_id IS NOT NULL;

  SELECT COUNT(*) INTO v_commissions
  FROM public.commissions
  WHERE reward_description LIKE '%(backfill)%';

  RAISE NOTICE 'Backfill: % enrollment đã link referral_code_id; % commission (backfill) tồn tại.',
    v_enroll_linked, v_commissions;

  IF v_commissions = 0 THEN
    RAISE WARNING 'Không có commission backfill nào được tạo — kiểm tra lại dữ liệu orders/enrollments/referral_codes.';
  END IF;
END $$;

-- Xem lại trước khi COMMIT:
--   SELECT program_type, beneficiary_code, referee_user_id, reward_type,
--          reward_rate, reward_amount_vnd, status
--   FROM public.commissions WHERE reward_description LIKE '%(backfill)%';

COMMIT;
