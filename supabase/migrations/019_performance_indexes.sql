-- Migration: 019_performance_indexes
-- Performance audit: composite indexes + drop superseded single-column indexes.
-- Run after: 018_profiles_role_ensure

-- ============================================================
-- DROP SUPERSEDED INDEXES
-- Each index below is fully covered by a new composite index.
-- Keeping both wastes write overhead on every INSERT/UPDATE.
-- ============================================================

-- Superseded by idx_checkins_cohort_date_mode (adds mode column)
drop index if exists public.idx_checkins_cohort_date;

-- Superseded by idx_enrollments_user_status (adds status column)
drop index if exists public.idx_enrollments_user;

-- Superseded by idx_dropout_signals_unresolved (adds created_at for ordering)
drop index if exists public.idx_dropout_unresolved;

-- Superseded by idx_nudge_logs_user_type_date (adds nudge_type + sent_at)
drop index if exists public.idx_nudge_logs_user;

-- Superseded by idx_community_posts_cohort_created (adds WHERE is_hidden=false)
drop index if exists public.idx_community_posts_cohort;

-- ============================================================
-- NEW COMPOSITE INDEXES
-- ============================================================

-- daily_checkins: enrollment feed ordered by date
-- Used by: dashboard timeline, check-in history, dropout-scanner batch fetch
create index if not exists idx_checkins_enrollment_date
  on public.daily_checkins(enrollment_id, workout_date desc);

-- daily_checkins: cohort activity feed filtered by mode
-- Used by: cohort leaderboard, analytics views, morning/evening Edge Functions
create index if not exists idx_checkins_cohort_date_mode
  on public.daily_checkins(cohort_id, workout_date, mode);

-- enrollments: user's enrollment list with status filter
-- Used by: dashboard, RLS policies (frequent auth.uid() = user_id AND status = ...)
create index if not exists idx_enrollments_user_status
  on public.enrollments(user_id, status);

-- nudge_logs: dedup guard in Edge Functions (user + type + date)
-- Used by: dropout-scanner, morning-reminder, evening-confirmation
create index if not exists idx_nudge_logs_user_type_date
  on public.nudge_logs(user_id, nudge_type, sent_at desc);

-- community_posts: cohort feed excluding hidden posts
-- Used by: community feed query; mirrors the RLS policy WHERE clause
create index if not exists idx_community_posts_cohort_created
  on public.community_posts(cohort_id, created_at desc)
  where is_hidden = false;

-- notifications: unread feed ordered by date (dashboard badge + notification list)
-- Used by: notifications panel; covers both unread-count and feed queries
create index if not exists idx_notifications_user_read
  on public.notifications(user_id, is_read, created_at desc);

-- ============================================================
-- PARTIAL INDEXES
-- ============================================================

-- enrollments: fast lookup of a user's single active enrollment
-- Used by: check-in flow, streak updates, nearly every authenticated request
create index if not exists idx_enrollments_active
  on public.enrollments(user_id)
  where status = 'active';

-- dropout_signals: unresolved signals ordered by recency
-- Used by: dropout-scanner dedup, admin rescue dashboard
create index if not exists idx_dropout_signals_unresolved
  on public.dropout_signals(enrollment_id, created_at desc)
  where resolved = false;

-- ============================================================
-- UPDATE PLANNER STATISTICS
-- Run after adding indexes so the planner can use them immediately.
-- ============================================================
analyze public.daily_checkins;
analyze public.enrollments;
analyze public.streaks;
analyze public.profiles;
analyze public.nudge_logs;
analyze public.notifications;
analyze public.dropout_signals;
analyze public.community_posts;
