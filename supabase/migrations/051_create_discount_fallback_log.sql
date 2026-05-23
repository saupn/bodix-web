-- Migration 051: discount_fallback_log
-- Tracks when resolveXxxReward() falls back to constants because DB row
-- was missing referee_reward_type or referee_reward_value.
--
-- After a clean backfill (migration 052) this table should stop receiving
-- inserts; any new rows indicate a code creation path that bypassed the
-- DB defaults — investigate via scripts/check-fallback-usage.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS public.discount_fallback_log (
  id            BIGSERIAL PRIMARY KEY,
  code_type     TEXT NOT NULL CHECK (code_type IN ('referral', 'affiliate', 'voucher')),
  code_id       UUID,
  code_masked   TEXT,
  missing_fields TEXT[] NOT NULL DEFAULT '{}',
  fallback_type TEXT,
  fallback_value NUMERIC,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  program_slug  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discount_fallback_log_created_at
  ON public.discount_fallback_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_discount_fallback_log_code_id
  ON public.discount_fallback_log (code_id)
  WHERE code_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_discount_fallback_log_code_type
  ON public.discount_fallback_log (code_type, created_at DESC);

-- RLS: only service_role inserts and reads. No public access.
ALTER TABLE public.discount_fallback_log ENABLE ROW LEVEL SECURITY;

-- Admins (role='admin' in profiles) can read for monitoring.
DROP POLICY IF EXISTS "Admins can read discount_fallback_log" ON public.discount_fallback_log;
CREATE POLICY "Admins can read discount_fallback_log"
  ON public.discount_fallback_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

COMMENT ON TABLE public.discount_fallback_log IS
  'Audit log: rows here mean a referral/affiliate/voucher code was missing reward fields and resolved via fallback constant. After migration 052, this should be empty.';

COMMIT;
