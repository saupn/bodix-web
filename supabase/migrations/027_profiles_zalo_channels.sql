-- Migration: 027_profiles_zalo_channels
-- Thêm cột Zalo/channel cho profiles (BodiX dùng profiles, không có bảng users)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS zalo_phone text,
  ADD COLUMN IF NOT EXISTS zalo_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferred_channel text DEFAULT 'zalo',
  ADD COLUMN IF NOT EXISTS channel_user_id text;
