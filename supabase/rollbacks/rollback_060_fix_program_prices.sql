-- DO NOT RUN AUTOMATICALLY. Manual rollback for migration 060.
-- ============================================================================
-- Khôi phục price_vnd của programs từ backup table programs_price_backup_20260530.
-- Backup table sẽ tồn tại sau khi migration 060 chạy thành công.
-- ============================================================================

BEGIN;

-- Safety: kiểm tra backup table tồn tại
DO $$
DECLARE
  backup_exists INT;
BEGIN
  SELECT COUNT(*) INTO backup_exists
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'programs_price_backup_20260530';

  IF backup_exists = 0 THEN
    RAISE EXCEPTION 'rollback_060: backup table public.programs_price_backup_20260530 không tồn tại – không thể restore';
  END IF;
END $$;

-- Restore giá cũ từ backup
UPDATE public.programs p
SET price_vnd = b.price_vnd
FROM public.programs_price_backup_20260530 b
WHERE p.id = b.id;

-- Verify: giá hiện tại = giá trong backup
DO $$
DECLARE
  mismatch_count INT;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM public.programs p
  JOIN public.programs_price_backup_20260530 b ON p.id = b.id
  WHERE p.price_vnd IS DISTINCT FROM b.price_vnd;

  IF mismatch_count > 0 THEN
    RAISE EXCEPTION 'rollback_060 failed: % program có giá lệch backup', mismatch_count;
  END IF;
END $$;

COMMIT;
