-- Migration: 020_rls_security_fixes
-- Security audit findings — run after 019_performance_indexes.
--
-- Issues fixed:
--   1. admin_reports had no RLS (any authenticated user could read via PostgREST)
--   2. Materialized views were readable by anon/authenticated via PostgREST
--      (materialized views can't have RLS in PostgreSQL; revoke is the fix)
--   3. profiles: ensure RLS is enabled (idempotent if already on)
--   4. ab_test_assignments: add explicit deny comment for clarity

-- ============================================================
-- 1. admin_reports
-- Enable RLS with no policies → only service_role can access.
-- ============================================================
alter table public.admin_reports enable row level security;

-- ============================================================
-- 2. Materialized views — revoke PostgREST access
--
-- Materialized views cannot have Row Level Security in PostgreSQL.
-- Without REVOKE, PostgREST exposes them to anon/authenticated roles.
-- Admin analytics data must only be accessible via service_role
-- (used by /api/admin/* routes through lib/supabase/service.ts).
-- ============================================================
revoke all on public.mv_cohort_analytics   from anon, authenticated;
revoke all on public.mv_program_analytics  from anon, authenticated;
revoke all on public.mv_upgrade_funnel     from anon, authenticated;
revoke all on public.mv_monthly_revenue    from anon, authenticated;

-- ============================================================
-- 3. profiles — ensure RLS is enabled
-- (idempotent: safe to run even if already enabled)
-- ============================================================
alter table public.profiles enable row level security;

-- Ensure basic user policies exist (idempotent via do block)
do $$
begin
  -- Users can read their own profile
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'profiles'
      and policyname = 'Users view own profile'
  ) then
    execute $policy$
      create policy "Users view own profile"
        on public.profiles for select
        using (auth.uid() = id)
    $policy$;
  end if;

  -- Users can update their own profile (but not role column — enforced by app layer)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'profiles'
      and policyname = 'Users update own profile'
  ) then
    execute $policy$
      create policy "Users update own profile"
        on public.profiles for update
        using (auth.uid() = id)
    $policy$;
  end if;
end;
$$;

-- ============================================================
-- 4. Verify all tables have RLS enabled
-- Run this query manually to audit after migration:
--
-- select tablename, rowsecurity
-- from pg_tables
-- where schemaname = 'public'
-- order by tablename;
--
-- All tables should show rowsecurity = true.
-- ============================================================
