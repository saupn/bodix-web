-- 064_notification_default_zalo.sql
-- Đổi default kênh thông báo sang 'zalo'.
--
-- Lý do: kiến trúc dual-channel — web users nhận qua Zalo (kênh chính), app
-- users qua FCM. Mặc định cũ 'email' không khớp hành vi thực tế của web user.
-- Trigger tạo notification_preferences sẽ dùng default mới cho user mới.
--
-- CHỈ đổi column default (DDL) — KHÔNG backfill các row hiện có để tôn trọng
-- lựa chọn người dùng đã set (không thể phân biệt 'email' do user chọn vs do
-- default cũ). Nếu Founder muốn flip các row 'email' cũ sang 'zalo', chạy thủ
-- công câu UPDATE ở cuối file (đang comment).

ALTER TABLE public.notification_preferences
  ALTER COLUMN preferred_channel SET DEFAULT 'zalo';

-- Optional backfill (CHẠY THỦ CÔNG nếu Founder xác nhận muốn flip):
-- UPDATE public.notification_preferences
--   SET preferred_channel = 'zalo'
--   WHERE preferred_channel = 'email';

-- Verify
DO $$
DECLARE
  v_default text;
BEGIN
  SELECT column_default INTO v_default
  FROM information_schema.columns
  WHERE table_name = 'notification_preferences'
    AND column_name = 'preferred_channel';
  IF v_default IS NULL OR v_default NOT LIKE '%zalo%' THEN
    RAISE EXCEPTION 'preferred_channel default not set to zalo (got: %)', v_default;
  END IF;
END $$;
