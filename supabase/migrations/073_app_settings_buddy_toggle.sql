-- 073_app_settings_buddy_toggle.sql
-- Bảng setting toàn cục (key/value) + cờ bật/tắt ghép cặp buddy.
--
-- Audit: repo CHƯA có bảng settings/config/flag nào (information_schema, 2026-08-31)
-- → tạo mới `app_settings`.
--
-- buddy_matching_enabled: MẶC ĐỊNH false → hệ thống KHÔNG tự ghép cặp ai.
-- Chỉ khi admin bật ở /admin/settings thì logic ghép (autoMatchCohort +
-- /api/buddy/choose) mới chạy.
--
-- Rollback: supabase/rollbacks/rollback_073_app_settings_buddy_toggle.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.app_settings (
  key         text PRIMARY KEY,
  value       jsonb       NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.app_settings IS
  'Setting toàn hệ thống dạng key/value. Đọc/ghi qua service role (lib/settings).';

-- ── RLS: chỉ service_role đọc/ghi. Client KHÔNG truy cập trực tiếp. ───────
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings admin read" ON public.app_settings;
CREATE POLICY "app_settings admin read" ON public.app_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ── Seed: buddy matching TẮT mặc định ─────────────────────────────────────
INSERT INTO public.app_settings (key, value, description)
VALUES (
  'buddy_matching_enabled',
  'false'::jsonb,
  'Bật/tắt ghép cặp buddy toàn hệ thống. false = không ghép ai, user giữ trạng thái "chưa ghép".'
)
ON CONFLICT (key) DO NOTHING;

-- ── Verify ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v jsonb;
BEGIN
  SELECT value INTO v FROM public.app_settings WHERE key = 'buddy_matching_enabled';
  IF v IS NULL THEN
    RAISE EXCEPTION 'Thiếu setting buddy_matching_enabled';
  END IF;
  RAISE NOTICE 'buddy_matching_enabled = %', v;
END $$;

COMMIT;
