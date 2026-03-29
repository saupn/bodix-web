-- 033: phone_verifications — Xác minh SĐT qua Zalo OA (thay thế phone_otps + eSMS)
-- Flow: user nhập SĐT → hệ thống tạo verify_code → user gửi code qua Zalo OA → webhook match & verify

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Function: generate 5-char verify code
-- Charset: ABCDEFGHJKMNPQRSTUVWXYZ23456789 (loại 0, O, I, 1, L)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION public.generate_verify_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..5 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Table
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE public.phone_verifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone       text        NOT NULL,
  verify_code text        NOT NULL UNIQUE DEFAULT public.generate_verify_code(),
  zalo_uid    text,
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'verified', 'expired')),
  expires_at  timestamptz NOT NULL,
  verified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Indexes
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE INDEX idx_phone_verifications_code
  ON public.phone_verifications (verify_code);

CREATE INDEX idx_phone_verifications_user_pending
  ON public.phone_verifications (user_id, status)
  WHERE status = 'pending';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- RLS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own verifications"
  ON public.phone_verifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own verifications"
  ON public.phone_verifications FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE/DELETE: chỉ service_role (không cần policy — RLS block mặc định)
