-- DO NOT RUN AUTOMATICALLY. Manual rollback for migration 055.
-- ============================================================================
-- Khôi phục CHECK constraint nudge_logs.nudge_type về danh sách gốc (10 type)
-- của migration 009 — XOÁ 4 type pre_cohort_d{N}.
--
-- CẢNH BÁO:
--   * Nếu đã có row trong nudge_logs với nudge_type IN ('pre_cohort_d1' ..
--     'pre_cohort_d4'), ADD CONSTRAINT sẽ FAIL.
--   * Phải xoá hoặc đổi tên các row đó trước. Verify block bên dưới sẽ raise
--     exception nếu phát hiện.
--   * Nếu cron `rescue-check` sub-task `pre_cohort` còn enable, dedup sẽ
--     fail silently trở lại sau khi rollback (regression về bug ban đầu).
--     Cân nhắc disable sub-task trước khi rollback.
-- ============================================================================

BEGIN;

-- Safety check 1: phát hiện row dùng nudge_type sắp bị xoá khỏi allow-list
DO $$
DECLARE
  bad_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM public.nudge_logs
  WHERE nudge_type IN (
    'pre_cohort_d1', 'pre_cohort_d2', 'pre_cohort_d3', 'pre_cohort_d4'
  );
  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'rollback_055 aborted: % rows still using pre_cohort_d{N}. '
      'DELETE/rename them first or rollback will fail at ADD CONSTRAINT.',
      bad_count;
  END IF;
END $$;

ALTER TABLE public.nudge_logs
  DROP CONSTRAINT IF EXISTS nudge_logs_nudge_type_check;

ALTER TABLE public.nudge_logs
  ADD CONSTRAINT nudge_logs_nudge_type_check
  CHECK (nudge_type IN (
    'morning_reminder',
    'evening_confirmation',
    'rescue_soft',
    'rescue_urgent',
    'rescue_critical',
    'milestone_celebration',
    'cohort_motivation',
    'trial_reminder',
    'trial_expired',
    'week_review'
  ));

-- Verify
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
    RAISE EXCEPTION 'rollback_055 failed: nudge_logs_nudge_type_check missing after re-add';
  END IF;
END $$;

COMMIT;
