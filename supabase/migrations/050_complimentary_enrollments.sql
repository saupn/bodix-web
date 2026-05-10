-- Migration: 050_complimentary_enrollments
-- Admin tặng vé miễn phí cho người quen / KOL / beta tester.
-- Đánh dấu enrollment KHÔNG có giao dịch tiền — phân biệt với enrollment đã
-- thanh toán SePay. Dùng cho stats (loại khỏi doanh thu) và badge UI.
--
-- Note: file 048 đã dùng cho daily_checkins_unique_day, 049 cho sepay_integration.
-- Đặt tên 050 để giữ thứ tự numeric.

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS is_complimentary boolean DEFAULT false;

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS complimentary_reason text;

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS granted_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_enrollments_complimentary
  ON public.enrollments(is_complimentary)
  WHERE is_complimentary = true;
