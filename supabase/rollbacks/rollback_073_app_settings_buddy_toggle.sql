-- DO NOT RUN AUTOMATICALLY.
-- Rollback cho 073_app_settings_buddy_toggle.sql
-- Xoá bảng app_settings (bảng mới hoàn toàn, không có dữ liệu cũ để restore).
-- Chạy THỦ CÔNG. Supabase CLI KHÔNG quét thư mục này.
--
-- LƯU Ý: sau khi rollback, code đọc setting (lib/settings/index.ts) sẽ fallback
-- về mặc định an toàn = false (buddy matching TẮT). Không vỡ runtime.

BEGIN;

-- ── Safety check: bảng phải tồn tại ───────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.app_settings') IS NULL THEN
    RAISE EXCEPTION 'public.app_settings không tồn tại – không có gì để rollback';
  END IF;
END $$;

-- ── Backup nội dung trước khi drop (phòng khi admin đã chỉnh giá trị) ─────
CREATE TABLE IF NOT EXISTS public.app_settings_backup_20260831 AS
SELECT * FROM public.app_settings;

DROP TABLE public.app_settings;

-- ── Verify ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.app_settings') IS NOT NULL THEN
    RAISE EXCEPTION 'app_settings vẫn còn tồn tại';
  END IF;
  RAISE NOTICE 'Đã drop app_settings (backup ở app_settings_backup_20260831)';
END $$;

COMMIT;
