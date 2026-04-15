-- Migration: 040_zalo_webhook_events
-- Dedup table for Zalo webhook events to prevent duplicate processing
-- when Zalo retries a webhook (timeout / missed ACK).

CREATE TABLE IF NOT EXISTS public.zalo_webhook_events (
  msg_id text PRIMARY KEY,
  zalo_uid text NOT NULL,
  event_name text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zalo_webhook_events_processed_at
  ON public.zalo_webhook_events(processed_at);

ALTER TABLE public.zalo_webhook_events ENABLE ROW LEVEL SECURITY;
-- service_role only, no user policies
