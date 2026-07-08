-- DO NOT RUN AUTOMATICALLY. Rollback thủ công cho migration 070_weekly_review_content.sql
-- Xóa bảng weekly_review_content. Chỉ chạy khi cần revert forward migration 070.
-- Bảng chỉ chứa nội dung admin nhập tay (Q&A/video) — không có inbound FK từ bảng khác,
-- nên DROP an toàn. Nếu muốn giữ dữ liệu, export trước khi chạy.

BEGIN;

-- Safety check: bảng phải tồn tại mới drop (tránh lỗi khi chạy lại).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'weekly_review_content'
  ) THEN
    RAISE NOTICE 'weekly_review_content không tồn tại — bỏ qua.';
  END IF;
END $$;

DROP TABLE IF EXISTS public.weekly_review_content;

-- Verify: bảng đã bị xóa.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'weekly_review_content'
  ) THEN
    RAISE EXCEPTION 'Rollback FAILED: weekly_review_content vẫn tồn tại.';
  END IF;
END $$;

COMMIT;
