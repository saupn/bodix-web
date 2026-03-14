-- Migration: 025_messaging_users_channel
-- Add columns for Messaging Adapter Layer: preferred_channel, channel_user_id
-- preferred_channel: 'zalo' (VN), 'whatsapp' (quốc tế sau này)
-- channel_user_id: UID trên kênh (Zalo UID, WhatsApp phone...)
--
-- Note: BodiX uses public.profiles. If public.users does not exist,
-- consider altering public.profiles instead, or create users table first.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS preferred_channel text DEFAULT 'zalo',
  ADD COLUMN IF NOT EXISTS channel_user_id text;
