-- DO NOT RUN AUTOMATICALLY. Manual rollback for migration 057.
-- ============================================================================
-- Drop partial UNIQUE INDEX và IMMUTABLE wrapper function của migration 057.
--
-- KHÔNG khôi phục row đã xoá vì:
--   * Row bị xoá là duplicate Zalo morning đã gửi cho user – row trẻ hơn là
--     không cần thiết, row cũ hơn vẫn còn.
--   * Restore từ backup sẽ khiến re-apply migration 057 fail ở bước DELETE
--     idempotent (vẫn còn duplicate).
--   * Nếu cần audit lại: SELECT * FROM public.nudge_logs_backup_20260525;
--     backup table KHÔNG bị drop.
-- ============================================================================

BEGIN;

-- Safety: kiểm tra backup table tồn tại để audit nếu cần
DO $$
DECLARE
  backup_exists INT;
BEGIN
  SELECT COUNT(*) INTO backup_exists
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'nudge_logs_backup_20260525';

  IF backup_exists = 0 THEN
    RAISE WARNING 'rollback_057: backup table public.nudge_logs_backup_20260525 không tồn tại – evidence của duplicate đã mất';
  END IF;
END $$;

-- Drop partial UNIQUE INDEX
DROP INDEX IF EXISTS public.idx_nudge_logs_unique_per_day_vn;

-- Drop IMMUTABLE wrapper (chỉ khi không có dependent index/constraint khác)
DROP FUNCTION IF EXISTS public.nudge_logs_vn_date(timestamptz);

-- Verify
DO $$
DECLARE
  index_exists BOOLEAN;
  func_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_nudge_logs_unique_per_day_vn'
  ) INTO index_exists;

  IF index_exists THEN
    RAISE EXCEPTION 'rollback_057 failed: index idx_nudge_logs_unique_per_day_vn vẫn tồn tại';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'nudge_logs_vn_date'
  ) INTO func_exists;

  IF func_exists THEN
    RAISE WARNING 'rollback_057: function nudge_logs_vn_date vẫn tồn tại – có thể có dependent khác';
  END IF;
END $$;

COMMIT;
