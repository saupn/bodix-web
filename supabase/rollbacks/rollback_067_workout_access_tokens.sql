-- DO NOT RUN AUTOMATICALLY.
-- Rollback cho 067_workout_access_tokens.sql
--
-- Bảng workout_access_tokens chỉ chứa token tạm (24h), KHÔNG có inbound FK từ
-- bảng khác → drop trực tiếp an toàn. Không cần backup table (dữ liệu ephemeral:
-- token hết hạn được cron rescue-check dọn; mất hết token chỉ khiến link Zalo cũ
-- fallback về /login, user vẫn đăng nhập bình thường được).
--
-- Chạy thủ công khi cần revert migration 067.

BEGIN;

-- Safety check: chỉ drop nếu bảng tồn tại (idempotent).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workout_access_tokens'
  ) THEN
    DROP TABLE public.workout_access_tokens;
    RAISE NOTICE 'Dropped table public.workout_access_tokens';
  ELSE
    RAISE NOTICE 'Table public.workout_access_tokens does not exist — nothing to drop';
  END IF;
END $$;

-- Verify: bảng đã biến mất.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workout_access_tokens'
  ) THEN
    RAISE EXCEPTION 'Rollback failed: workout_access_tokens still exists';
  END IF;
END $$;

COMMIT;
