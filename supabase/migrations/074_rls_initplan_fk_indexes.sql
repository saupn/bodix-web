-- 074_rls_initplan_fk_indexes.sql
-- Tối ưu RLS + index khoá ngoại theo Supabase performance advisor (2026-10-24).
--
-- 1) auth_rls_initplan (56 policy): biểu thức gọi thẳng auth.uid() / auth.role() /
--    auth.jwt() bị Postgres tính lại cho TỪNG DÒNG. Bọc thành (select auth.uid())
--    để tính MỘT lần mỗi câu lệnh (initPlan). Logic quyền KHÔNG đổi: chỉ thêm
--    "(select …)" quanh đúng lời gọi hàm, mọi điều kiện khác giữ nguyên văn.
--    Định nghĩa gốc được chụp vào public.rls_policy_backup_20261024 TRƯỚC khi sửa.
--    scripts/verify_074_rls_initplan.sql so lại từng policy với bản gốc.
--
-- 2) unindexed_foreign_keys (27 FK): thêm index b-tree cho cột khoá ngoại chưa
--    có index (join/lọc theo cột đó và ON DELETE ở bảng cha nhanh hơn).
--
-- Không đụng dữ liệu. Không gộp các policy permissive trùng nhau (multiple_
-- permissive_policies) – để migration riêng nếu cần, vì thay đổi đó khó review.
--
-- Rollback: supabase/rollbacks/rollback_074_rls_initplan_fk_indexes.sql
-- Audit trước: scripts/audit_074_rls_initplan.sql · Verify sau: scripts/verify_074_rls_initplan.sql

BEGIN;

-- ── 1a. Backup định nghĩa policy gốc (nguồn cho rollback + verify) ─────────
CREATE TABLE IF NOT EXISTS public.rls_policy_backup_20261024 AS
SELECT schemaname, tablename, policyname, cmd, roles, permissive, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    coalesce(qual, '')       ~ '(?<!SELECT )auth\.(uid|role|jwt)\(\)'
    OR coalesce(with_check, '') ~ '(?<!SELECT )auth\.(uid|role|jwt)\(\)'
  );

-- Bảng backup chỉ dành cho admin/SQL editor: bật RLS, không policy → client không đọc được.
ALTER TABLE public.rls_policy_backup_20261024 ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.rls_policy_backup_20261024 IS
  'Backup định nghĩa RLS trước migration 074 (giữ ≥ 30 ngày). Dùng cho rollback_074.';

-- ── 1b. Bọc auth.*() bằng (select …) ──────────────────────────────────────
DO $$
DECLARE
  r record;
  new_qual  text;
  new_check text;
  pattern   constant text := '(?<!SELECT )auth\.(uid|role|jwt)\(\)';
  n         int := 0;
BEGIN
  FOR r IN SELECT * FROM public.rls_policy_backup_20261024 LOOP
    new_qual  := regexp_replace(r.qual,       pattern, '(select auth.\1())', 'g');
    new_check := regexp_replace(r.with_check, pattern, '(select auth.\1())', 'g');

    IF new_qual IS NOT NULL AND new_check IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',
                     r.policyname, r.schemaname, r.tablename, new_qual, new_check);
    ELSIF new_qual IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)',
                     r.policyname, r.schemaname, r.tablename, new_qual);
    ELSIF new_check IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
                     r.policyname, r.schemaname, r.tablename, new_check);
    END IF;
    n := n + 1;
  END LOOP;
  RAISE NOTICE '074: đã cập nhật % policy', n;
END $$;

-- ── 2. Index cho khoá ngoại chưa có index ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_app_settings_updated_by_fk              ON public.app_settings (updated_by);
CREATE INDEX IF NOT EXISTS idx_body_checks_user_id_fk                  ON public.body_checks (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to_id_fk            ON public.chat_messages (reply_to_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_user_id_fk              ON public.community_posts (user_id);
CREATE INDEX IF NOT EXISTS idx_community_reactions_user_id_fk          ON public.community_reactions (user_id);
CREATE INDEX IF NOT EXISTS idx_discount_fallback_log_user_id_fk        ON public.discount_fallback_log (user_id);
CREATE INDEX IF NOT EXISTS idx_dropout_signals_user_id_fk              ON public.dropout_signals (user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_program_id_fk               ON public.enrollments (program_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_voucher_id_fk               ON public.enrollments (voucher_id);
CREATE INDEX IF NOT EXISTS idx_mid_program_reflections_user_id_fk      ON public.mid_program_reflections (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_confirmed_by_fk                  ON public.orders (confirmed_by);
CREATE INDEX IF NOT EXISTS idx_progress_photos_user_id_fk              ON public.progress_photos (user_id);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_enrollment_id_fk      ON public.referral_tracking (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_program_id_fk         ON public.referral_tracking (program_id);
CREATE INDEX IF NOT EXISTS idx_rescue_replies_enrollment_id_fk         ON public.rescue_replies (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_rescue_replies_intervention_id_fk       ON public.rescue_replies (rescue_intervention_id);
CREATE INDEX IF NOT EXISTS idx_rescue_replies_resolved_by_fk           ON public.rescue_replies (resolved_by);
CREATE INDEX IF NOT EXISTS idx_review_videos_cohort_id_fk              ON public.review_videos (cohort_id);
CREATE INDEX IF NOT EXISTS idx_review_videos_program_id_fk             ON public.review_videos (program_id);
CREATE INDEX IF NOT EXISTS idx_sepay_webhook_events_matched_order_fk   ON public.sepay_webhook_events (matched_order_id);
CREATE INDEX IF NOT EXISTS idx_trial_activities_program_id_fk          ON public.trial_activities (program_id);
CREATE INDEX IF NOT EXISTS idx_user_questions_enrollment_id_fk         ON public.user_questions (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_user_questions_user_id_fk               ON public.user_questions (user_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_source_referral_tracking_fk    ON public.vouchers (source_referral_tracking_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reviews_review_video_id_fk       ON public.weekly_reviews (review_video_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reviews_user_id_fk               ON public.weekly_reviews (user_id);
CREATE INDEX IF NOT EXISTS idx_workout_access_tokens_enrollment_id_fk  ON public.workout_access_tokens (enrollment_id);

-- ── Verify trong transaction: không còn lời gọi auth.*() chưa bọc ────────
DO $$
DECLARE
  remaining int;
BEGIN
  SELECT count(*) INTO remaining
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      coalesce(qual, '')       ~ '(?<!SELECT )auth\.(uid|role|jwt)\(\)'
      OR coalesce(with_check, '') ~ '(?<!SELECT )auth\.(uid|role|jwt)\(\)'
    );
  IF remaining > 0 THEN
    RAISE EXCEPTION '074: còn % policy gọi auth.*() chưa bọc', remaining;
  END IF;
END $$;

COMMIT;
