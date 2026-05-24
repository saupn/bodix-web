-- ============================================================================
-- 055: Bổ sung pre_cohort_d{1..4} vào nudge_logs.nudge_type CHECK constraint
-- ============================================================================
-- Lý do: cron `rescue-check` sub-task `pre_cohort` insert vào nudge_logs với
-- nudge_type ∈ {'pre_cohort_d1','pre_cohort_d2','pre_cohort_d3','pre_cohort_d4'},
-- nhưng constraint hiện tại (migration 009) không include 4 type này →
-- INSERT raise check_violation, edge function nuốt error → dedup KHÔNG hoạt động
-- → user có thể nhận tin nhắn pre-cohort trùng lặp.
--
-- Audit trước khi apply (2026-05-24):
--   * pg_constraint cho nudge_logs_nudge_type_check liệt kê 10 type:
--       morning_reminder, evening_confirmation, rescue_soft, rescue_urgent,
--       rescue_critical, milestone_celebration, cohort_motivation,
--       trial_reminder, trial_expired, week_review
--   * Cả 10 đều giữ nguyên — chỉ THÊM 4 type pre_cohort_d{N}.
--   * pre_cohort_d{N} chưa từng được insert (constraint chặn) → không cần
--     backfill dữ liệu, không cần backup table.
--   * CHECK mới là superset của CHECK cũ → không có row hiện hữu nào violate.
--
-- Thao tác (DDL, không UPDATE data): drop + re-add constraint trong 1 transaction.
-- DDL trên PostgreSQL lấy ACCESS EXCLUSIVE lock trên table nhưng thao tác này
-- chỉ rewrite catalog (không scan table data) nên rất nhanh — không phải concern
-- về lock table lâu.
-- ============================================================================

BEGIN;

ALTER TABLE public.nudge_logs
  DROP CONSTRAINT IF EXISTS nudge_logs_nudge_type_check;

ALTER TABLE public.nudge_logs
  ADD CONSTRAINT nudge_logs_nudge_type_check
  CHECK (nudge_type IN (
    -- Original từ migration 009 (KHÔNG xoá type nào — giữ tương thích ngược)
    'morning_reminder',
    'evening_confirmation',
    'rescue_soft',
    'rescue_urgent',
    'rescue_critical',
    'milestone_celebration',
    'cohort_motivation',
    'trial_reminder',
    'trial_expired',
    'week_review',
    -- Pre-cohort notifications: gửi 4 / 3 / 2 / 1 ngày trước cohort start
    -- cho user paid_waiting_cohort đã được gán cohort_id.
    'pre_cohort_d1',
    'pre_cohort_d2',
    'pre_cohort_d3',
    'pre_cohort_d4'
  ));

-- Sanity check: constraint hiện diện
DO $$
DECLARE
  has_constraint BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.nudge_logs'::regclass
      AND conname = 'nudge_logs_nudge_type_check'
  ) INTO has_constraint;
  IF NOT has_constraint THEN
    RAISE EXCEPTION 'Migration 055 failed: nudge_logs_nudge_type_check missing after re-add';
  END IF;
END $$;

COMMIT;
