-- 070_weekly_review_content.sql
-- Nội dung Q&A + video cho tin Review Chủ nhật, admin nhập trước theo cohort/tuần.
-- Cron morning-messages (sáng CN) đọc bảng này để chèn "Giải đáp tuần này" + link video.
-- Không có row → tin Review vẫn hoàn chỉnh (bỏ 2 khối optional).
-- Chỉ CREATE TABLE (không UPDATE/DELETE dữ liệu) → không cần backup table.

CREATE TABLE IF NOT EXISTS public.weekly_review_content (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id       uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,               -- thứ 2 đầu tuần (theo lịch VN)
  qa_content      text,                        -- nội dung Q&A / tip tuần
  video_url       text,                        -- link video Nhìn lại (Vimeo), nullable
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_weekly_review_content_lookup
  ON public.weekly_review_content (cohort_id, week_start_date);

-- RLS: bật, KHÔNG policy nào → chỉ service_role truy cập (admin API dùng service client
-- sau verifyAdmin). User thường không đọc/ghi trực tiếp.
ALTER TABLE public.weekly_review_content ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.weekly_review_content IS
  'Q&A + video cho tin Review Chủ nhật, admin nhập trước theo (cohort_id, week_start_date=thứ 2 VN).';
