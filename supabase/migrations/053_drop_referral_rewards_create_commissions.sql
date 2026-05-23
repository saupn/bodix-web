-- Migration: 053_drop_referral_rewards_create_commissions
-- Drop bảng referral_rewards (legacy V1, 0 rows) và tạo bảng commissions V2 (generic cho cả referral và affiliate).
-- Task này CHỈ implement program_type='affiliate'. Logic referral sẽ làm task BD-REFERRAL-VOUCHER-FLOW sau.

BEGIN;

-- ============================================
-- 1. BACKUP referral_rewards (CLAUDE.md convention)
-- ============================================
-- Giữ backup ≥ 30 ngày trước khi xóa hẳn.
CREATE TABLE IF NOT EXISTS public.referral_rewards_backup_20260523 AS
  SELECT * FROM public.referral_rewards;

-- Safety check: chỉ drop nếu thực sự 0 rows (như đã verify).
DO $$
DECLARE
  row_count INT;
BEGIN
  SELECT COUNT(*) INTO row_count FROM public.referral_rewards;
  IF row_count > 0 THEN
    RAISE EXCEPTION 'referral_rewards has % rows; aborting drop. Backup created at referral_rewards_backup_20260523.', row_count;
  END IF;
END $$;

-- ============================================
-- 2. DROP referral_rewards
-- ============================================
DROP TABLE IF EXISTS public.referral_rewards CASCADE;

-- ============================================
-- 3. CREATE commissions
-- ============================================
CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Phân loại program
  program_type TEXT NOT NULL CHECK (program_type IN ('referral', 'affiliate')),

  -- Người nhận reward (referrer hoặc affiliate)
  beneficiary_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  beneficiary_code TEXT NOT NULL,

  -- Người tạo conversion (referee/buyer)
  referee_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE SET NULL,
  order_id BIGINT,

  -- Tiền và reward
  order_amount_vnd INTEGER NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('cash_commission', 'voucher', 'discount_percent', 'free_extension')),
  reward_rate NUMERIC(5,2),
  reward_amount_vnd INTEGER NOT NULL,
  reward_description TEXT,

  -- Status flow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'payable',
    'paid',
    'cancelled',
    'suspicious'
  )),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  purchase_at TIMESTAMPTZ NOT NULL,
  payable_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  pending_expires_at TIMESTAMPTZ NOT NULL,

  -- Audit
  cancel_reason TEXT,
  status_history JSONB DEFAULT '[]'::jsonb NOT NULL,

  -- Metadata
  source_url TEXT,
  ip_address TEXT,
  user_agent TEXT,

  -- Self-referral guard
  CONSTRAINT commissions_no_self_referral CHECK (beneficiary_user_id <> referee_user_id)
);

-- ============================================
-- 4. INDEXES
-- ============================================
CREATE INDEX idx_commissions_beneficiary ON public.commissions(beneficiary_user_id, status);
CREATE INDEX idx_commissions_referee ON public.commissions(referee_user_id);
CREATE INDEX idx_commissions_program_status ON public.commissions(program_type, status);
CREATE INDEX idx_commissions_status_expires ON public.commissions(status, pending_expires_at);
CREATE INDEX idx_commissions_enrollment ON public.commissions(enrollment_id);

-- ============================================
-- 5. RLS
-- ============================================
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

-- Người nhận xem commission của mình (cả 2 program_type)
CREATE POLICY "Users view own commissions" ON public.commissions
  FOR SELECT
  USING (auth.uid() = beneficiary_user_id);

-- Service role bypass RLS hoàn toàn (insert/update từ webhook & cron)

-- ============================================
-- 6. UPDATED_AT trigger
-- ============================================
-- Không có column updated_at, vì status_history đã ghi nhật ký mọi transition.

COMMIT;
