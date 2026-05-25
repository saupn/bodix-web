-- ============================================================================
-- 057: Defensive UNIQUE INDEX trên nudge_logs chống duplicate per-day per-user
-- ============================================================================
-- Mục đích: DB-level guard cho các nudge_type chỉ được gửi tối đa 1 lần
-- / user / ngày VN. Atomic – không phụ thuộc check-then-write logic ở app
-- (race-prone khi có nhiều invocation song song).
--
-- Áp dụng cho 10 nudge_type one-per-day:
--   morning_reminder, evening_confirmation, trial_expired,
--   pre_cohort_d1..d4, rescue_soft, rescue_urgent, rescue_critical
--
-- KHÔNG bao gồm: milestone_celebration, cohort_motivation, trial_reminder,
-- week_review (có thể fire nhiều lần / ngày tuỳ trigger – không one-per-day).
--
-- Phụ thuộc kỹ thuật: cần IMMUTABLE wrapper function để convert timestamptz
-- → ngày VN, vì `timestamptz AT TIME ZONE 'literal'` trong PG là STABLE
-- (không dùng được trong expression index). Function dùng `AT TIME ZONE 'UTC'`
-- + offset 7 giờ + cast date – thực sự immutable cho 'Asia/Ho_Chi_Minh'
-- (không có DST từ 1975).
--
-- Tiền xử lý: ngày 2026-05-25 phát hiện 1 row duplicate (user ad98f5d8…,
-- morning_reminder). Backup vào nudge_logs_backup_20260525 + DELETE row trẻ
-- hơn trước khi tạo UNIQUE INDEX.
-- ============================================================================

BEGIN;

-- ─── 1. Backup duplicate rows (idempotent: chỉ tạo nếu chưa tồn tại) ───
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'nudge_logs_backup_20260525'
  ) THEN
    CREATE TABLE public.nudge_logs_backup_20260525 AS
    SELECT nl.*
    FROM public.nudge_logs nl
    JOIN (
      SELECT user_id, nudge_type, ((sent_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) AS day_vn
      FROM public.nudge_logs
      GROUP BY user_id, nudge_type, ((sent_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
      HAVING COUNT(*) > 1
    ) dups
      ON nl.user_id = dups.user_id
     AND nl.nudge_type = dups.nudge_type
     AND ((nl.sent_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) = dups.day_vn;
  END IF;
END $$;

-- ─── 2. Xoá duplicate trong các nudge_type one-per-day: giữ row OLDEST ───
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, nudge_type, ((sent_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.nudge_logs
  WHERE nudge_type IN (
    'morning_reminder', 'evening_confirmation', 'trial_expired',
    'pre_cohort_d1', 'pre_cohort_d2', 'pre_cohort_d3', 'pre_cohort_d4',
    'rescue_soft', 'rescue_urgent', 'rescue_critical'
  )
)
DELETE FROM public.nudge_logs
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ─── 3. IMMUTABLE wrapper: timestamptz → ngày VN ───
-- 'Asia/Ho_Chi_Minh' = UTC+7 cố định (không có DST từ 1975). Body dùng
-- `AT TIME ZONE 'UTC'` (zone literal cố định, nội tại immutable) + cộng
-- offset 7 giờ + cast `::date` trên timestamp (không phải timestamptz)
-- → toàn bộ chuỗi an toàn để mark IMMUTABLE.
CREATE OR REPLACE FUNCTION public.nudge_logs_vn_date(ts timestamptz)
RETURNS date
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$ SELECT (((ts AT TIME ZONE 'UTC') + INTERVAL '7 hours'))::date $$;

COMMENT ON FUNCTION public.nudge_logs_vn_date(timestamptz) IS
  'Convert timestamptz → ngày VN (UTC+7). IMMUTABLE để dùng trong expression index của nudge_logs. An toàn vì VN không có DST.';

-- ─── 4. Partial UNIQUE INDEX cho các nudge_type one-per-day ───
CREATE UNIQUE INDEX IF NOT EXISTS idx_nudge_logs_unique_per_day_vn
ON public.nudge_logs (
  user_id,
  nudge_type,
  public.nudge_logs_vn_date(sent_at)
)
WHERE nudge_type IN (
  'morning_reminder',
  'evening_confirmation',
  'trial_expired',
  'pre_cohort_d1',
  'pre_cohort_d2',
  'pre_cohort_d3',
  'pre_cohort_d4',
  'rescue_soft',
  'rescue_urgent',
  'rescue_critical'
);

-- ─── 5. Verify ───
DO $$
DECLARE
  dup_count BIGINT;
  index_exists BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT user_id, nudge_type, public.nudge_logs_vn_date(sent_at) AS day_vn
    FROM public.nudge_logs
    WHERE nudge_type IN (
      'morning_reminder', 'evening_confirmation', 'trial_expired',
      'pre_cohort_d1', 'pre_cohort_d2', 'pre_cohort_d3', 'pre_cohort_d4',
      'rescue_soft', 'rescue_urgent', 'rescue_critical'
    )
    GROUP BY user_id, nudge_type, day_vn
    HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Migration 057 failed: vẫn còn % cặp duplicate sau khi DELETE', dup_count;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'nudge_logs'
      AND indexname = 'idx_nudge_logs_unique_per_day_vn'
  ) INTO index_exists;

  IF NOT index_exists THEN
    RAISE EXCEPTION 'Migration 057 failed: index idx_nudge_logs_unique_per_day_vn không được tạo';
  END IF;
END $$;

COMMIT;
