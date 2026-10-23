-- DO NOT RUN AUTOMATICALLY.
-- Rollback cho 074_rls_initplan_fk_indexes.sql
-- Chạy THỦ CÔNG (SQL Editor / psql). Supabase CLI KHÔNG quét thư mục này.
--
-- 1) Trả mọi policy về đúng định nghĩa gốc lưu trong
--    public.rls_policy_backup_20261024 (ALTER POLICY, không drop/create).
-- 2) Xoá 27 index idx_*_fk do migration 074 tạo.
-- Không đụng dữ liệu. Giữ bảng backup (xoá tay sau ≥ 30 ngày).

BEGIN;

-- ── Safety check: backup phải tồn tại và có dữ liệu ──────────────────────
DO $$
DECLARE
  n int;
BEGIN
  IF to_regclass('public.rls_policy_backup_20261024') IS NULL THEN
    RAISE EXCEPTION 'Thiếu public.rls_policy_backup_20261024 – không rollback được policy';
  END IF;
  SELECT count(*) INTO n FROM public.rls_policy_backup_20261024;
  IF n = 0 THEN
    RAISE EXCEPTION 'rls_policy_backup_20261024 rỗng – dừng';
  END IF;
  RAISE NOTICE 'Backup có % policy', n;
END $$;

-- ── 1. Khôi phục policy ──────────────────────────────────────────────────
DO $$
DECLARE
  r record;
  n int := 0;
BEGIN
  FOR r IN SELECT * FROM public.rls_policy_backup_20261024 LOOP
    -- Policy có thể đã bị xoá/đổi tên sau 074 → bỏ qua, báo lại.
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = r.schemaname AND tablename = r.tablename AND policyname = r.policyname
    ) THEN
      RAISE NOTICE 'Bỏ qua (không còn tồn tại): %.%', r.tablename, r.policyname;
      CONTINUE;
    END IF;

    IF r.qual IS NOT NULL AND r.with_check IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',
                     r.policyname, r.schemaname, r.tablename, r.qual, r.with_check);
    ELSIF r.qual IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)',
                     r.policyname, r.schemaname, r.tablename, r.qual);
    ELSIF r.with_check IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
                     r.policyname, r.schemaname, r.tablename, r.with_check);
    END IF;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'Đã khôi phục % policy', n;
END $$;

-- ── 2. Xoá index do 074 tạo ──────────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_app_settings_updated_by_fk;
DROP INDEX IF EXISTS public.idx_body_checks_user_id_fk;
DROP INDEX IF EXISTS public.idx_chat_messages_reply_to_id_fk;
DROP INDEX IF EXISTS public.idx_community_posts_user_id_fk;
DROP INDEX IF EXISTS public.idx_community_reactions_user_id_fk;
DROP INDEX IF EXISTS public.idx_discount_fallback_log_user_id_fk;
DROP INDEX IF EXISTS public.idx_dropout_signals_user_id_fk;
DROP INDEX IF EXISTS public.idx_enrollments_program_id_fk;
DROP INDEX IF EXISTS public.idx_enrollments_voucher_id_fk;
DROP INDEX IF EXISTS public.idx_mid_program_reflections_user_id_fk;
DROP INDEX IF EXISTS public.idx_orders_confirmed_by_fk;
DROP INDEX IF EXISTS public.idx_progress_photos_user_id_fk;
DROP INDEX IF EXISTS public.idx_referral_tracking_enrollment_id_fk;
DROP INDEX IF EXISTS public.idx_referral_tracking_program_id_fk;
DROP INDEX IF EXISTS public.idx_rescue_replies_enrollment_id_fk;
DROP INDEX IF EXISTS public.idx_rescue_replies_intervention_id_fk;
DROP INDEX IF EXISTS public.idx_rescue_replies_resolved_by_fk;
DROP INDEX IF EXISTS public.idx_review_videos_cohort_id_fk;
DROP INDEX IF EXISTS public.idx_review_videos_program_id_fk;
DROP INDEX IF EXISTS public.idx_sepay_webhook_events_matched_order_fk;
DROP INDEX IF EXISTS public.idx_trial_activities_program_id_fk;
DROP INDEX IF EXISTS public.idx_user_questions_enrollment_id_fk;
DROP INDEX IF EXISTS public.idx_user_questions_user_id_fk;
DROP INDEX IF EXISTS public.idx_vouchers_source_referral_tracking_fk;
DROP INDEX IF EXISTS public.idx_weekly_reviews_review_video_id_fk;
DROP INDEX IF EXISTS public.idx_weekly_reviews_user_id_fk;
DROP INDEX IF EXISTS public.idx_workout_access_tokens_enrollment_id_fk;

-- ── Verify: mọi policy còn tồn tại khớp đúng bản gốc ─────────────────────
DO $$
DECLARE
  mismatched int;
  idx_left int;
BEGIN
  SELECT count(*) INTO mismatched
  FROM public.rls_policy_backup_20261024 b
  JOIN pg_policies p
    ON p.schemaname = b.schemaname AND p.tablename = b.tablename AND p.policyname = b.policyname
  WHERE p.qual IS DISTINCT FROM b.qual OR p.with_check IS DISTINCT FROM b.with_check;
  IF mismatched > 0 THEN
    RAISE EXCEPTION 'Rollback: % policy chưa khớp bản gốc', mismatched;
  END IF;

  SELECT count(*) INTO idx_left
  FROM pg_indexes
  WHERE schemaname = 'public' AND indexname LIKE 'idx\_%\_fk' ESCAPE '\'
    AND indexname IN (
      'idx_app_settings_updated_by_fk','idx_body_checks_user_id_fk','idx_chat_messages_reply_to_id_fk',
      'idx_community_posts_user_id_fk','idx_community_reactions_user_id_fk','idx_discount_fallback_log_user_id_fk',
      'idx_dropout_signals_user_id_fk','idx_enrollments_program_id_fk','idx_enrollments_voucher_id_fk',
      'idx_mid_program_reflections_user_id_fk','idx_orders_confirmed_by_fk','idx_progress_photos_user_id_fk',
      'idx_referral_tracking_enrollment_id_fk','idx_referral_tracking_program_id_fk','idx_rescue_replies_enrollment_id_fk',
      'idx_rescue_replies_intervention_id_fk','idx_rescue_replies_resolved_by_fk','idx_review_videos_cohort_id_fk',
      'idx_review_videos_program_id_fk','idx_sepay_webhook_events_matched_order_fk','idx_trial_activities_program_id_fk',
      'idx_user_questions_enrollment_id_fk','idx_user_questions_user_id_fk','idx_vouchers_source_referral_tracking_fk',
      'idx_weekly_reviews_review_video_id_fk','idx_weekly_reviews_user_id_fk','idx_workout_access_tokens_enrollment_id_fk'
    );
  IF idx_left > 0 THEN
    RAISE EXCEPTION 'Rollback: còn % index của 074', idx_left;
  END IF;
  RAISE NOTICE 'Rollback 074 OK';
END $$;

COMMIT;
