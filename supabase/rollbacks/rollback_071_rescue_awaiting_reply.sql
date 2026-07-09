-- DO NOT RUN AUTOMATICALLY.
-- Rollback thủ công cho 071_rescue_awaiting_reply.sql.
--
-- Revert: bỏ cột rescue_interventions.awaiting_reply_until + xoá bảng rescue_replies.
--
-- CẢNH BÁO: rescue_replies chứa tin tâm sự thật của user. DROP TABLE là mất dữ liệu
-- không phục hồi được. Script tự tạo backup table trước khi drop.

BEGIN;

-- ── Safety: chỉ chạy khi bảng thật sự tồn tại (idempotent) ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'rescue_replies'
  ) THEN
    RAISE NOTICE 'rescue_replies không tồn tại — bỏ qua phần bảng.';
  END IF;
END $$;

-- ── Backup trước khi drop (giữ ≥ 30 ngày) ──
CREATE TABLE IF NOT EXISTS public.rescue_replies_backup_20260709 AS
  SELECT * FROM public.rescue_replies;

-- ── Drop bảng + index (index đi theo bảng) ──
DROP TABLE IF EXISTS public.rescue_replies;

-- ── Bỏ cột awaiting trên rescue_interventions ──
-- Không neutralise gì thêm: cột nullable, không có FK inbound, không bảng nào tham chiếu.
DROP INDEX IF EXISTS public.idx_rescue_awaiting;

ALTER TABLE public.rescue_interventions
  DROP COLUMN IF EXISTS awaiting_reply_until;

-- ── Verify ──
DO $$
DECLARE
  col_left  int;
  tbl_left  int;
  backed_up int;
BEGIN
  SELECT count(*) INTO col_left
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'rescue_interventions'
    AND column_name = 'awaiting_reply_until';

  SELECT count(*) INTO tbl_left
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'rescue_replies';

  SELECT count(*) INTO backed_up
  FROM public.rescue_replies_backup_20260709;

  IF col_left <> 0 THEN
    RAISE EXCEPTION 'Rollback FAILED: cột awaiting_reply_until vẫn còn.';
  END IF;
  IF tbl_left <> 0 THEN
    RAISE EXCEPTION 'Rollback FAILED: bảng rescue_replies vẫn còn.';
  END IF;

  RAISE NOTICE 'Rollback 071 OK. Đã backup % dòng vào rescue_replies_backup_20260709.', backed_up;
END $$;

COMMIT;
