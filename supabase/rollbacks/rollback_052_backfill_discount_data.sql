-- ─────────────────────────────────────────────────────────────────────────
-- DO NOT RUN AUTOMATICALLY.
--
-- This file is the rollback for `supabase/migrations/052_backfill_discount_data.sql`.
-- It lives in `supabase/rollbacks/` (NOT `supabase/migrations/`) so that
-- `supabase db push` will never apply it. Run only when you have decided
-- migration 052 needs to be reverted.
--
-- Why this file does NOT use TRUNCATE:
--   `referral_codes.id` is referenced by FKs from at least:
--     - enrollments.referral_code_id          (enrollments_referral_code_id_fkey)
--     - referral_tracking.referral_code_id    (referral_tracking_referral_code_id_fkey)
--   TRUNCATE on the parent table is rejected by Postgres (SQLSTATE 0A000),
--   and TRUNCATE CASCADE would silently wipe user enrollments — never
--   acceptable. We use targeted UPDATE/DELETE instead.
--
-- Manual run example (replace <conn>):
--   psql "<conn>" -v ON_ERROR_STOP=1 -f supabase/rollbacks/rollback_052_backfill_discount_data.sql
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Safety: backup tables must exist ─────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.referral_codes_backup_20260523') IS NULL THEN
    RAISE EXCEPTION 'Backup table referral_codes_backup_20260523 not found – refusing to rollback';
  END IF;
  IF to_regclass('public.profiles_referral_code_backup_20260523') IS NULL THEN
    RAISE EXCEPTION 'Backup table profiles_referral_code_backup_20260523 not found – refusing to rollback';
  END IF;
END $$;

-- ── 2. Restore reward fields on rows that EXISTED before backfill ───────────
-- Idempotent: writing the same backup value twice is harmless.
UPDATE public.referral_codes AS rc
SET
  referee_reward_type  = bk.referee_reward_type,
  referee_reward_value = bk.referee_reward_value,
  updated_at           = bk.updated_at
FROM public.referral_codes_backup_20260523 AS bk
WHERE rc.id = bk.id
  AND (
       rc.referee_reward_type  IS DISTINCT FROM bk.referee_reward_type
    OR rc.referee_reward_value IS DISTINCT FROM bk.referee_reward_value
  );

-- ── 3. Remove rows INSERTED by migration 052 ────────────────────────────────
-- Migration 052 promoted profiles.referral_code legacy entries into
-- referral_codes. Identify those rows: they exist in current referral_codes
-- AND in profiles_referral_code_backup_20260523 (by UPPER(TRIM(code))) BUT NOT
-- in referral_codes_backup_20260523.
--
-- IMPORTANT: only DELETE if no FK reference exists. If an enrollment has
-- already pointed at the promoted row (unlikely right after backfill but
-- possible), DO NOT delete — neutralise it by clearing reward fields and
-- setting is_active=false so the code path returns to fallback. The team can
-- re-evaluate manually.

WITH promoted_rows AS (
  SELECT rc.id, rc.code
  FROM public.referral_codes rc
  WHERE NOT EXISTS (
    SELECT 1 FROM public.referral_codes_backup_20260523 bk WHERE bk.id = rc.id
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles_referral_code_backup_20260523 pb
    WHERE UPPER(TRIM(pb.referral_code)) = rc.code
  )
),
referenced_promoted AS (
  SELECT pr.id
  FROM promoted_rows pr
  WHERE EXISTS (SELECT 1 FROM public.enrollments e        WHERE e.referral_code_id = pr.id)
     OR EXISTS (SELECT 1 FROM public.referral_tracking rt WHERE rt.referral_code_id = pr.id)
),
neutralised AS (
  UPDATE public.referral_codes
  SET referee_reward_type  = NULL,
      referee_reward_value = NULL,
      is_active            = false,
      updated_at           = NOW()
  WHERE id IN (SELECT id FROM referenced_promoted)
  RETURNING id
),
deleted AS (
  DELETE FROM public.referral_codes
  WHERE id IN (
    SELECT id FROM promoted_rows
    EXCEPT
    SELECT id FROM referenced_promoted
  )
  RETURNING id
)
SELECT
  (SELECT COUNT(*) FROM deleted)      AS rows_deleted,
  (SELECT COUNT(*) FROM neutralised)  AS rows_neutralised;

-- ── 4. Verify ───────────────────────────────────────────────────────────────
DO $$
DECLARE
  backup_rows        INT;
  matched            INT;
  promoted_remaining INT;
BEGIN
  SELECT COUNT(*) INTO backup_rows FROM public.referral_codes_backup_20260523;

  SELECT COUNT(*) INTO matched
  FROM public.referral_codes rc
  JOIN public.referral_codes_backup_20260523 bk ON rc.id = bk.id
  WHERE rc.referee_reward_type  IS NOT DISTINCT FROM bk.referee_reward_type
    AND rc.referee_reward_value IS NOT DISTINCT FROM bk.referee_reward_value;

  IF matched <> backup_rows THEN
    RAISE EXCEPTION 'Rollback verification failed: matched=% backup=%', matched, backup_rows;
  END IF;

  SELECT COUNT(*) INTO promoted_remaining
  FROM public.referral_codes rc
  WHERE NOT EXISTS (SELECT 1 FROM public.referral_codes_backup_20260523 bk WHERE bk.id = rc.id)
    AND EXISTS (
      SELECT 1 FROM public.profiles_referral_code_backup_20260523 pb
      WHERE UPPER(TRIM(pb.referral_code)) = rc.code
    )
    AND rc.is_active = true;

  IF promoted_remaining > 0 THEN
    RAISE EXCEPTION 'Rollback verification failed: % promoted rows still active', promoted_remaining;
  END IF;

  RAISE NOTICE 'Rollback verified: % backup rows matched, 0 promoted rows still active.', matched;
END $$;

-- ── 5. Keep backup tables (≥30 days per BD-MIGRATION-FIX constraint) ────────
-- Do NOT drop:
--   - public.referral_codes_backup_20260523
--   - public.profiles_referral_code_backup_20260523
-- The team will drop manually after backfill stability is confirmed.

COMMIT;
