-- ============================================================================
-- 056: Drop duplicate pg_cron jobs (Vercel cron đã chạy cùng schedule)
-- ============================================================================
-- Lý do: `bodix-morning-messages` và `bodix-rescue-check` đang chạy SONG SONG
-- với 2 entry trong vercel.json (cùng cron schedule, cùng endpoint). Kết quả:
-- endpoint /api/cron/morning-messages bị invoke 2 lần lúc 23:30 UTC → user
-- nhận 2 tin Zalo morning giống hệt nhau – race condition giữa
-- alreadySentToday check và INSERT nudge_logs (check-then-write không atomic).
--
-- Bằng chứng (ngày 2026-05-25):
--   * 2 row trong nudge_logs cùng user_id, cùng nudge_type 'morning_reminder',
--     sent_at cách nhau 542ms (06:30:06.338 và 06:30:06.880 ICT).
--   * vercel.json:19-22 schedule '30 23 * * *' và '0 15 * * *' cho cùng 2
--     endpoint mà pg_cron đang gọi (xem migration 028).
--
-- Quyết định: GIỮ Vercel cron (0 hop, single source of truth checked-in git),
-- BỎ pg_cron 2 jobs duplicate. Giữ nguyên 'bodix-refresh-token' (mỗi 20 giờ,
-- không có Vercel duplicate) và 'bodix-cleanup-otps' (mỗi giờ, không có
-- Vercel duplicate).
--
-- KHÔNG xoá function `call_bodix_cron` – vẫn dùng bởi 2 job còn lại.
-- ============================================================================

BEGIN;

-- ─── 1. Backup snapshot cron.job state trước khi unschedule ───
-- Idempotent: chỉ tạo nếu chưa tồn tại
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cron_job_backup_20260525'
  ) THEN
    CREATE TABLE public.cron_job_backup_20260525 AS
    SELECT jobid, schedule, command, nodename, nodeport, database, username, active, jobname
    FROM cron.job
    WHERE jobname IN ('bodix-morning-messages', 'bodix-rescue-check');
  END IF;
END $$;

-- ─── 2. Unschedule 2 jobs duplicate (idempotent qua EXISTS check) ───
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bodix-morning-messages') THEN
    PERFORM cron.unschedule('bodix-morning-messages');
    RAISE NOTICE 'Unscheduled pg_cron job: bodix-morning-messages';
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bodix-rescue-check') THEN
    PERFORM cron.unschedule('bodix-rescue-check');
    RAISE NOTICE 'Unscheduled pg_cron job: bodix-rescue-check';
  END IF;
END $$;

-- ─── 3. Verify ───
DO $$
DECLARE
  remaining INT;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM cron.job
  WHERE jobname IN ('bodix-morning-messages', 'bodix-rescue-check');

  IF remaining > 0 THEN
    RAISE EXCEPTION 'Migration 056 failed: % duplicate pg_cron job(s) còn lại', remaining;
  END IF;
END $$;

COMMIT;
