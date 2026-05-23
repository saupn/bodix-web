-- Rollback for migration 052_backfill_discount_data.sql
--
-- Strategy:
--   - Restore referral_codes from the backup table created in migration 052
--   - Drop the backup tables once restore is verified
--
-- WARNING: this DELETES any referral_codes rows created AFTER migration 052
-- ran. If there have been new signups using the legacy profiles.referral_code
-- path, those rows will be removed. Reconcile manually before running this if
-- the migration has been live for more than a few minutes.

BEGIN;

-- Safety check: backup tables must exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'referral_codes_backup_20260523'
  ) THEN
    RAISE EXCEPTION 'Backup table referral_codes_backup_20260523 not found — refusing to rollback';
  END IF;
END $$;

-- Restore referral_codes to pre-migration state
TRUNCATE public.referral_codes;
INSERT INTO public.referral_codes
  SELECT * FROM public.referral_codes_backup_20260523;

-- Verify restore matched backup row count
DO $$
DECLARE
  backup_rows INT;
  current_rows INT;
BEGIN
  SELECT COUNT(*) INTO backup_rows FROM public.referral_codes_backup_20260523;
  SELECT COUNT(*) INTO current_rows FROM public.referral_codes;

  IF backup_rows <> current_rows THEN
    RAISE EXCEPTION 'Rollback verification failed: backup=% restored=%', backup_rows, current_rows;
  END IF;

  RAISE NOTICE 'Rollback verified: % rows restored from backup.', current_rows;
END $$;

-- Drop the backup tables (uncomment only after rollback verified in app)
-- DROP TABLE IF EXISTS public.referral_codes_backup_20260523;
-- DROP TABLE IF EXISTS public.profiles_referral_code_backup_20260523;

COMMIT;
