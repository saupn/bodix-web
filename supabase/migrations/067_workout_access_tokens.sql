-- 067_workout_access_tokens.sql
-- Magic-link phiên tập: token gắn 1 user, hết hạn 24h, scope giới hạn.
-- Token sinh khi cron morning gửi tin Zalo; verify ở route /w/[token] → set
-- cookie scoped → vào thẳng phiên tập hôm nay, KHÔNG cần đăng nhập đầy đủ.
--
-- Bảo mật:
--  - token random >= 32 byte (base64url), không đoán được
--  - bind user_id trực tiếp (KHÔNG qua channel_user_id — có row trùng)
--  - reusable đến hết hạn (KHÔNG one-time → tránh link-preview bot nuốt token)
--  - scope mặc định 'workout_checkin' — chỉ mở 2 route workout + check-in
--  - RLS bật, KHÔNG policy cho anon/authenticated → chỉ service_role đọc/ghi.
--    Verify token đi qua service client (lib/workout-token).

CREATE TABLE IF NOT EXISTS public.workout_access_tokens (
  token         text PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE CASCADE,
  scope         text NOT NULL DEFAULT 'workout_checkin',
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_wat_user ON public.workout_access_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_wat_expires ON public.workout_access_tokens(expires_at);

-- RLS: bật nhưng KHÔNG tạo policy nào → mọi truy cập qua anon/authenticated bị
-- chặn. Chỉ service_role (bypass RLS) đọc/ghi được. Token là bí mật cấp truy cập,
-- không được lộ cho client.
ALTER TABLE public.workout_access_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.workout_access_tokens IS
  'Magic-link tokens cho phiên tập (Zalo morning link). Service-role only. Reusable đến expires_at (24h).';
