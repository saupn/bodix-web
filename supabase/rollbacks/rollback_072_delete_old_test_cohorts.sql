-- DO NOT RUN AUTOMATICALLY.
-- Rollback cho 072_delete_old_test_cohorts.sql
-- Khôi phục 2 cohort đã xoá từ cohorts_backup_20260831.
-- Chạy THỦ CÔNG (psql / SQL editor). Supabase CLI KHÔNG quét thư mục này.

BEGIN;

-- ── Safety check: backup table phải tồn tại và có đủ 2 row ────────────────
DO $$
DECLARE
  n int;
BEGIN
  IF to_regclass('public.cohorts_backup_20260831') IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy cohorts_backup_20260831 – KHÔNG thể rollback';
  END IF;

  SELECT count(*) INTO n FROM public.cohorts_backup_20260831;
  IF n <> 2 THEN
    RAISE EXCEPTION 'Backup có % row (kỳ vọng 2) – DỪNG', n;
  END IF;
END $$;

-- ── Restore (INSERT lại; nếu id đã tồn tại thì bỏ qua) ────────────────────
INSERT INTO public.cohorts
SELECT * FROM public.cohorts_backup_20260831
ON CONFLICT (id) DO NOTHING;

-- ── Verify ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  restored int;
BEGIN
  SELECT count(*) INTO restored FROM public.cohorts
  WHERE id IN (
    'd5caf6ab-a71a-4b0c-9e36-2d93117750e6',
    '8612c307-4eb4-40a3-9ce7-bad9931deaf5'
  );

  IF restored <> 2 THEN
    RAISE EXCEPTION 'Chỉ khôi phục được % / 2 cohort', restored;
  END IF;

  RAISE NOTICE 'Đã khôi phục 2 cohort';
END $$;

COMMIT;
