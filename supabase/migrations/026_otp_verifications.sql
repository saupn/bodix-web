-- Migration: 026_otp_verifications
-- Bảng OTP cho Zalo OTP verification (messaging adapter)

CREATE TABLE IF NOT EXISTS public.otp_verifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone text NOT NULL,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  attempts int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_phone ON public.otp_verifications(phone);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON public.otp_verifications(expires_at);
