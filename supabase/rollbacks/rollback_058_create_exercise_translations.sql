-- DO NOT RUN AUTOMATICALLY. Manual rollback for migration 058.
-- ============================================================================
-- Drop bảng exercise_translations + index + RLS policy.
--
-- An toàn: bảng này chỉ là lookup table, không có inbound FK từ bảng khác.
-- Forward migration không UPDATE/DELETE dữ liệu hiện có nên không cần backup.
-- ============================================================================

BEGIN;

-- Safety: kiểm tra không có FK trỏ về bảng này (defensive — không nên có)
DO $$
DECLARE
  fk_count INT;
BEGIN
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.constraint_column_usage ccu
  JOIN information_schema.table_constraints tc
    ON tc.constraint_name = ccu.constraint_name
   AND tc.constraint_schema = ccu.constraint_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_schema = 'public'
    AND ccu.table_name = 'exercise_translations';

  IF fk_count > 0 THEN
    RAISE EXCEPTION 'rollback_058 aborted: % FK(s) trỏ về exercise_translations – drop sẽ phá vỡ relationship', fk_count;
  END IF;
END $$;

-- Drop policy → table (index tự drop theo table)
DROP POLICY IF EXISTS "exercise_translations_select_all"
  ON public.exercise_translations;

DROP TABLE IF EXISTS public.exercise_translations;

-- Verify
DO $$
DECLARE
  table_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'exercise_translations'
  ) INTO table_exists;

  IF table_exists THEN
    RAISE EXCEPTION 'rollback_058 failed: table exercise_translations vẫn tồn tại';
  END IF;
END $$;

COMMIT;
