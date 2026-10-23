-- verify_074_rls_initplan.sql
-- Chạy SAU khi `supabase db push` migration 074 (SQL Editor / psql / supabase db execute).
-- Chỉ đọc. Mỗi mục in PASS/FAIL.

-- 1. Backup tồn tại và có đủ policy
select case when count(*) > 0
  then 'PASS: backup có ' || count(*) || ' policy'
  else 'FAIL: backup rỗng/thiếu' end
from public.rls_policy_backup_20261024;

-- 2. Không còn lời gọi auth.*() chưa bọc
select case when count(*) = 0
  then 'PASS: không còn auth.*() chưa bọc'
  else 'FAIL: còn ' || count(*) || ' policy chưa bọc' end
from pg_policies
where schemaname = 'public'
  and (coalesce(qual, '')       ~ '(?<!SELECT )auth\.(uid|role|jwt)\(\)'
    or coalesce(with_check, '') ~ '(?<!SELECT )auth\.(uid|role|jwt)\(\)');

-- 3. KHÔNG nới quyền: mỗi policy, sau khi gỡ lớp "( SELECT auth.x() AS x)",
--    phải trùng KHỚP TỪNG KÝ TỰ với định nghĩa gốc; cmd/roles/permissive giữ nguyên.
with cur as (
  select p.schemaname, p.tablename, p.policyname, p.cmd, p.roles, p.permissive,
    regexp_replace(p.qual,       '\( SELECT auth\.(uid|role|jwt)\(\) AS (uid|role|jwt)\)', 'auth.\1()', 'g') as qual_norm,
    regexp_replace(p.with_check, '\( SELECT auth\.(uid|role|jwt)\(\) AS (uid|role|jwt)\)', 'auth.\1()', 'g') as check_norm
  from pg_policies p
)
select case when count(*) = 0
  then 'PASS: mọi policy giữ nguyên logic so với bản gốc'
  else 'FAIL: ' || count(*) || ' policy khác bản gốc – xem truy vấn 4' end
from public.rls_policy_backup_20261024 b
left join cur c using (schemaname, tablename, policyname)
where c.policyname is null
   or c.qual_norm  is distinct from b.qual
   or c.check_norm is distinct from b.with_check
   or c.cmd        is distinct from b.cmd
   or c.roles      is distinct from b.roles
   or c.permissive is distinct from b.permissive;

-- 4. (Chỉ xem khi mục 3 FAIL) chi tiết policy khác bản gốc
with cur as (
  select p.schemaname, p.tablename, p.policyname,
    regexp_replace(p.qual,       '\( SELECT auth\.(uid|role|jwt)\(\) AS (uid|role|jwt)\)', 'auth.\1()', 'g') as qual_norm,
    regexp_replace(p.with_check, '\( SELECT auth\.(uid|role|jwt)\(\) AS (uid|role|jwt)\)', 'auth.\1()', 'g') as check_norm
  from pg_policies p
)
select b.tablename, b.policyname, b.qual as before_qual, c.qual_norm as after_qual_normalized,
       b.with_check as before_check, c.check_norm as after_check_normalized
from public.rls_policy_backup_20261024 b
left join cur c using (schemaname, tablename, policyname)
where c.policyname is null
   or c.qual_norm  is distinct from b.qual
   or c.check_norm is distinct from b.with_check;

-- 5. Đủ 27 index khoá ngoại
select case when count(*) = 27
  then 'PASS: đủ 27 index _fk'
  else 'FAIL: chỉ có ' || count(*) || '/27 index' end
from pg_indexes
where schemaname = 'public'
  and indexname in (
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

-- 6. Bảng backup bật RLS (client không đọc được)
select case when relrowsecurity
  then 'PASS: backup bật RLS' else 'FAIL: backup chưa bật RLS' end
from pg_class where oid = 'public.rls_policy_backup_20261024'::regclass;
