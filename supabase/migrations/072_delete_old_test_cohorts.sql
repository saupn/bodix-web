-- 072_delete_old_test_cohorts.sql
-- Xoá 2 cohort test/quá hạn đã được Founder xác nhận (enrollment_count = 0).
--
--   d5caf6ab-a71a-4b0c-9e36-2d93117750e6  Test Cohort 1  (start 2026-04-17, đã hết hạn)
--   8612c307-4eb4-40a3-9ce7-bad9931deaf5  Đợt tập 6B     (start 2026-06-22, đã quá hạn)
--
-- GIỮ LẠI: 03cffd73-5f35-42d4-9891-bb4ac4800697 (Test C9, 2026-09-04) – dùng để test tiếp.
--
-- Audit FK tới public.cohorts (pg_constraint, 2026-08-31) – 7 bảng con:
--   buddy_pairs.cohort_id            NO ACTION
--   community_posts.cohort_id        NO ACTION
--   daily_checkins.cohort_id         NO ACTION
--   enrollments.cohort_id            NO ACTION
--   review_videos.cohort_id          NO ACTION
--   user_questions.cohort_id         NO ACTION
--   weekly_review_content.cohort_id  ON DELETE CASCADE
--
-- Cả 7 bảng hiện đang có 0 row cho 2 cohort này. Migration KHÔNG xoá dữ liệu con:
-- nó CHẶN (RAISE EXCEPTION) nếu bất kỳ bảng con nào còn row – tránh mất dữ liệu
-- người dùng thật nếu chạy lại ở môi trường khác.
--
-- Rollback: supabase/rollbacks/rollback_072_delete_old_test_cohorts.sql

BEGIN;

-- ── Backup trước khi xoá (giữ ≥ 30 ngày) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS cohorts_backup_20260831 AS
SELECT * FROM public.cohorts
WHERE id IN (
  'd5caf6ab-a71a-4b0c-9e36-2d93117750e6',
  '8612c307-4eb4-40a3-9ce7-bad9931deaf5'
);

-- ── Safety check: mọi bảng con phải trống cho 2 cohort này ────────────────
DO $$
DECLARE
  target uuid[] := ARRAY[
    'd5caf6ab-a71a-4b0c-9e36-2d93117750e6',
    '8612c307-4eb4-40a3-9ce7-bad9931deaf5'
  ]::uuid[];
  child   text;
  cnt     bigint;
BEGIN
  FOREACH child IN ARRAY ARRAY[
    'enrollments',
    'daily_checkins',
    'buddy_pairs',
    'community_posts',
    'review_videos',
    'user_questions',
    'weekly_review_content'
  ] LOOP
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE cohort_id = ANY($1)', child
    ) INTO cnt USING target;

    IF cnt > 0 THEN
      RAISE EXCEPTION
        'Cohort còn % row ở bảng %, DỪNG không xoá', cnt, child;
    END IF;
  END LOOP;
END $$;

-- ── Xoá cohort ────────────────────────────────────────────────────────────
DELETE FROM public.cohorts
WHERE id IN (
  'd5caf6ab-a71a-4b0c-9e36-2d93117750e6',
  '8612c307-4eb4-40a3-9ce7-bad9931deaf5'
);

-- ── Verify sau xoá ────────────────────────────────────────────────────────
DO $$
DECLARE
  remaining  int;
  still_here int;
BEGIN
  SELECT count(*) INTO remaining FROM public.cohorts;

  SELECT count(*) INTO still_here FROM public.cohorts
  WHERE id IN (
    'd5caf6ab-a71a-4b0c-9e36-2d93117750e6',
    '8612c307-4eb4-40a3-9ce7-bad9931deaf5'
  );

  IF still_here > 0 THEN
    RAISE EXCEPTION 'Vẫn còn % cohort chưa xoá', still_here;
  END IF;

  RAISE NOTICE 'Còn lại % cohort (kỳ vọng: 1 – Test C9)', remaining;
END $$;

COMMIT;
