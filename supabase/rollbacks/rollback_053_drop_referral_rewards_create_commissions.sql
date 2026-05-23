-- DO NOT RUN AUTOMATICALLY.
-- Rollback for migration 053_drop_referral_rewards_create_commissions.
-- Restore referral_rewards from backup, drop commissions.

BEGIN;

-- ============================================
-- Safety: backup table must exist
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'referral_rewards_backup_20260523'
  ) THEN
    RAISE EXCEPTION 'Backup table referral_rewards_backup_20260523 not found; aborting rollback.';
  END IF;
END $$;

-- ============================================
-- 1. Drop commissions (no inbound FK)
-- ============================================
DROP TABLE IF EXISTS public.commissions CASCADE;

-- ============================================
-- 2. Restore referral_rewards from backup
-- ============================================
CREATE TABLE public.referral_rewards AS
  SELECT * FROM public.referral_rewards_backup_20260523;

-- Restore PK + indexes (matching original 013_referral_affiliate.sql)
ALTER TABLE public.referral_rewards ADD PRIMARY KEY (id);

-- ============================================
-- 3. Restore RLS
-- ============================================
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own rewards" ON public.referral_rewards
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- 4. Verify
-- ============================================
DO $$
DECLARE
  restored_count INT;
  backup_count INT;
BEGIN
  SELECT COUNT(*) INTO restored_count FROM public.referral_rewards;
  SELECT COUNT(*) INTO backup_count FROM public.referral_rewards_backup_20260523;
  IF restored_count <> backup_count THEN
    RAISE EXCEPTION 'Restore mismatch: backup has % rows, restored % rows.', backup_count, restored_count;
  END IF;
  RAISE NOTICE 'Rollback OK: % rows restored.', restored_count;
END $$;

COMMIT;
