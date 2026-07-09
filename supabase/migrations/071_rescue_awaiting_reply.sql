-- 071_rescue_awaiting_reply.sql
-- Cửa sổ "chờ user tâm sự" sau tin rescue + hộp thư Founder cần trả lời tay.
--
-- 1) rescue_interventions.awaiting_reply_until — sau khi gửi rescue L1/L2/L3, user
--    có 48h mà mọi tin text (không phải số check-in) được coi là tâm sự.
-- 2) rescue_replies — mỗi tin tâm sự nhận được, để Founder trả lời tay và đánh dấu
--    đã xử lý. KHÔNG đẩy vào FAQ/fallback.
--
-- Chỉ ADD COLUMN (nullable) + CREATE TABLE — không UPDATE/DELETE dữ liệu hiện có
-- → không cần backup table.

-- ── 1. Cửa sổ awaiting trên rescue_interventions ──
ALTER TABLE public.rescue_interventions
  ADD COLUMN IF NOT EXISTS awaiting_reply_until timestamptz;

COMMENT ON COLUMN public.rescue_interventions.awaiting_reply_until IS
  'Hết hạn cửa sổ 48h coi tin text của user là tâm sự (NULL = không chờ / đã đóng do check-in lại).';

-- Tra cứu nóng ở webhook: "user này có đang trong cửa sổ awaiting không?"
CREATE INDEX IF NOT EXISTS idx_rescue_awaiting
  ON public.rescue_interventions (user_id, awaiting_reply_until DESC)
  WHERE awaiting_reply_until IS NOT NULL;

-- ── 2. Hộp thư tâm sự cần Founder trả lời ──
CREATE TABLE IF NOT EXISTS public.rescue_replies (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrollment_id           uuid REFERENCES public.enrollments(id) ON DELETE SET NULL,
  rescue_intervention_id  uuid REFERENCES public.rescue_interventions(id) ON DELETE SET NULL,
  message_text            text NOT NULL,
  received_at             timestamptz NOT NULL DEFAULT now(),
  -- Ngày lịch VN của tin (YYYY-MM-DD). Dùng để giới hạn câu ấm áp 1 lần/ngày/user
  -- mà không phải tính lại offset +07 trong query.
  received_ymd            date NOT NULL,
  -- true = câu ấm áp đã được gửi cho tin này (tin sau trong ngày → false).
  ack_sent                boolean NOT NULL DEFAULT false,
  status                  text NOT NULL DEFAULT 'needs_founder_reply'
                            CHECK (status IN ('needs_founder_reply', 'resolved')),
  resolved_at             timestamptz,
  resolved_by             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- Inbox Founder: lọc theo status, mới nhất trước.
CREATE INDEX IF NOT EXISTS idx_rescue_replies_status
  ON public.rescue_replies (status, received_at DESC);

-- Guard "1 câu ấm áp/ngày/user": tìm nhanh row ack_sent hôm nay.
CREATE INDEX IF NOT EXISTS idx_rescue_replies_ack_today
  ON public.rescue_replies (user_id, received_ymd)
  WHERE ack_sent;

-- RLS: bật, KHÔNG policy nào → chỉ service_role truy cập (webhook ghi bằng service
-- client; admin API dùng service client sau verifyAdmin). User thường không đọc/ghi.
ALTER TABLE public.rescue_replies ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.rescue_replies IS
  'Tin tâm sự user gửi trong cửa sổ 48h sau tin rescue. Founder trả lời tay qua Zalo OA rồi đánh dấu resolved.';
