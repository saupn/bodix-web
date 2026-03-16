-- Migration: 029_personalized_referral_codes
-- Mã giới thiệu cá nhân hóa theo tên (LAN, NGUYENLAN, LAN.BODIX)
-- Tích hợp với referral_codes hiện có cho r/[code] và checkout

-- 1. Thêm cột vào profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by text,
  ADD COLUMN IF NOT EXISTS referral_count int DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);

COMMENT ON COLUMN public.profiles.referral_code IS 'Mã giới thiệu cá nhân (VD: LAN, NGUYENLAN)';
COMMENT ON COLUMN public.profiles.referred_by IS 'Mã của người giới thiệu (để hiển thị)';
COMMENT ON COLUMN public.profiles.referral_count IS 'Số người đã đăng ký qua mã của mình';

-- 2. Bảng tracking đơn giản (bổ sung referral_tracking)
CREATE TABLE IF NOT EXISTS public.referrals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  referrer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  referrer_code text NOT NULL,
  referred_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_email text,
  status text DEFAULT 'registered' CHECK (status IN ('registered', 'paid', 'completed')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referrer_code);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- User xem referrals do mình giới thiệu
CREATE POLICY "Users view own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id);
