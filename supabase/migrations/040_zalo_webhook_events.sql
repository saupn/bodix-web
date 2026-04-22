-- Migration: 040_zalo_webhook_events
-- Dedup table for Zalo webhook events to prevent duplicate processing
-- when Zalo retries a webhook (timeout / missed ACK).

CREATE TABLE IF NOT EXISTS public.zalo_webhook_events (
  msg_id text PRIMARY KEY,
  zalo_uid text NOT NULL,
  event_name text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- NOTE: index trên processed_at bị comment out vì bảng zalo_webhook_events
-- có thể đã tồn tại trên prod với schema cũ (không có cột processed_at).
-- Chạy query sau để kiểm tra cột thực tế:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'zalo_webhook_events';
-- Nếu có processed_at → uncomment block dưới.
-- Nếu chỉ có msg_id + created_at → dùng index trên created_at.
-- CREATE INDEX IF NOT EXISTS idx_zalo_webhook_events_processed_at
--   ON public.zalo_webhook_events(processed_at);

ALTER TABLE public.zalo_webhook_events ENABLE ROW LEVEL SECURITY;
-- service_role only, no user policies
