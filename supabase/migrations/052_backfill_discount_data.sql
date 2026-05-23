-- Migration 052: backfill discount data
-- Goals:
--   1. Backup referral_codes and profiles before any UPDATE/INSERT
--   2. Backfill any referral_codes rows missing referee_reward_type/value
--      with defaults discount_percent / 10 (matching REFERRAL_DISCOUNT_PERCENT
--      and AFFILIATE_DISCOUNT_PERCENT in lib/affiliate/config.ts)
--   3. Promote any profiles.referral_code that has no row in referral_codes
--      to a proper referral_codes row (legacy path → DB source of truth)
--   4. Verify: after migration, the resolve_reward fallback path should
--      not be hit by any existing data
--
-- Rollback: see 052_backfill_discount_data_rollback.sql

BEGIN;

-- ── 1. Backups ───────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.referral_codes_backup_20260523;
CREATE TABLE public.referral_codes_backup_20260523 AS
  SELECT * FROM public.referral_codes;

DROP TABLE IF EXISTS public.profiles_referral_code_backup_20260523;
CREATE TABLE public.profiles_referral_code_backup_20260523 AS
  SELECT id, referral_code, full_name
  FROM public.profiles
  WHERE referral_code IS NOT NULL;

-- ── 2. Backfill dirty referral_codes rows ───────────────────────────────────
-- Default policy (confirmed 2026-05-23):
--   referral  → discount_percent, 10
--   affiliate → discount_percent, 10
-- Both align with the constants in lib/affiliate/config.ts.

WITH updated AS (
  UPDATE public.referral_codes
  SET
    referee_reward_type  = COALESCE(referee_reward_type, 'discount_percent'),
    referee_reward_value = CASE
      WHEN referee_reward_value IS NULL OR referee_reward_value <= 0 THEN 10
      ELSE referee_reward_value
    END,
    updated_at = NOW()
  WHERE referee_reward_type IS NULL
     OR referee_reward_value IS NULL
     OR referee_reward_value <= 0
  RETURNING id
)
SELECT
  COUNT(*) AS referral_codes_rows_updated,
  '052_backfill_discount_data: referral_codes' AS step
FROM updated;

-- ── 3. Promote legacy profiles.referral_code → referral_codes ────────────────
-- Any profile that has set referral_code but doesn't yet have a row in
-- referral_codes triggers the fallback constant path. Create proper rows.

WITH inserted AS (
  INSERT INTO public.referral_codes (
    user_id,
    code,
    code_type,
    referee_reward_type,
    referee_reward_value,
    reward_type,
    reward_value,
    commission_rate,
    commission_type,
    is_active,
    is_affiliate
  )
  SELECT
    p.id                        AS user_id,
    UPPER(TRIM(p.referral_code)) AS code,
    'referral'                  AS code_type,
    'discount_percent'          AS referee_reward_type,
    10                          AS referee_reward_value,
    'credit'                    AS reward_type,
    0                           AS reward_value,
    0                           AS commission_rate,
    'percentage'                AS commission_type,
    true                        AS is_active,
    false                       AS is_affiliate
  FROM public.profiles p
  WHERE p.referral_code IS NOT NULL
    AND TRIM(p.referral_code) <> ''
    AND NOT EXISTS (
      SELECT 1 FROM public.referral_codes rc
      WHERE rc.code = UPPER(TRIM(p.referral_code))
    )
  RETURNING id
)
SELECT
  COUNT(*) AS legacy_profiles_promoted,
  '052_backfill_discount_data: profiles → referral_codes' AS step
FROM inserted;

-- ── 4. Verify: no dirty rows remain ──────────────────────────────────────────
DO $$
DECLARE
  remaining_dirty INT;
  unpromoted_legacy INT;
BEGIN
  SELECT COUNT(*) INTO remaining_dirty
  FROM public.referral_codes
  WHERE referee_reward_type IS NULL
     OR referee_reward_value IS NULL
     OR referee_reward_value <= 0;

  IF remaining_dirty > 0 THEN
    RAISE EXCEPTION 'Backfill failed: % referral_codes rows still dirty', remaining_dirty;
  END IF;

  SELECT COUNT(*) INTO unpromoted_legacy
  FROM public.profiles p
  WHERE p.referral_code IS NOT NULL
    AND TRIM(p.referral_code) <> ''
    AND NOT EXISTS (
      SELECT 1 FROM public.referral_codes rc
      WHERE rc.code = UPPER(TRIM(p.referral_code))
    );

  IF unpromoted_legacy > 0 THEN
    RAISE EXCEPTION 'Backfill failed: % legacy profiles.referral_code rows not promoted', unpromoted_legacy;
  END IF;

  RAISE NOTICE 'Backfill verified: 0 dirty referral_codes, 0 unpromoted legacy profiles.';
END $$;

COMMIT;
