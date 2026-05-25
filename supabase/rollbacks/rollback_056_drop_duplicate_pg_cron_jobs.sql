-- DO NOT RUN AUTOMATICALLY. Manual rollback for migration 056.
-- ============================================================================
-- Khôi phục 2 pg_cron jobs đã unschedule trong migration 056.
-- ----------------------------------------------------------------------------
-- CẢNH BÁO:
--   * Sau rollback, pg_cron VÀ Vercel cron sẽ CÙNG chạy lại → bug duplicate
--     Zalo morning message quay trở lại.
--   * CHỈ rollback nếu Vercel cron đang DOWN và cần fallback từ pg_cron;
--     khi đó cũng nên TẠM XOÁ entry tương ứng trong vercel.json để tránh race.
-- ============================================================================

BEGIN;

-- Safety check: backup table tồn tại và có data
DO $$
DECLARE
  table_exists INT;
  backup_count INT;
BEGIN
  SELECT COUNT(*) INTO table_exists
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'cron_job_backup_20260525';

  IF table_exists = 0 THEN
    RAISE EXCEPTION 'rollback_056 aborted: backup table public.cron_job_backup_20260525 không tồn tại';
  END IF;

  SELECT COUNT(*) INTO backup_count FROM public.cron_job_backup_20260525;
  IF backup_count = 0 THEN
    RAISE EXCEPTION 'rollback_056 aborted: backup table rỗng – không có gì để khôi phục';
  END IF;
END $$;

-- Re-schedule từ backup snapshot (chỉ những job chưa tồn tại để idempotent)
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT jobname, schedule, command FROM public.cron_job_backup_20260525 LOOP
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = rec.jobname) THEN
      PERFORM cron.schedule(rec.jobname, rec.schedule, rec.command);
      RAISE NOTICE 'Restored pg_cron job: %', rec.jobname;
    END IF;
  END LOOP;
END $$;

-- Verify
DO $$
DECLARE
  cnt INT;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM cron.job
  WHERE jobname IN ('bodix-morning-messages', 'bodix-rescue-check');

  IF cnt < 2 THEN
    RAISE EXCEPTION 'rollback_056 failed: chỉ có %/2 job được khôi phục', cnt;
  END IF;
END $$;

COMMIT;
