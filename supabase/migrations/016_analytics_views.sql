-- Migration: 016_analytics_views
-- Requires: 003_create_program_engine, 005_create_completion_engine,
--           012_review_system, 014_enrollments_referral

-- ============================================
-- 1. COHORT ANALYTICS
-- ============================================
create materialized view public.mv_cohort_analytics as
select
  c.id                    as cohort_id,
  c.name                  as cohort_name,
  p.slug                  as program_slug,
  p.name                  as program_name,
  p.duration_days,
  c.start_date,
  c.end_date,
  c.status                as cohort_status,
  c.current_members,

  count(distinct e.id)    as total_enrollments,

  count(distinct case when e.status = 'completed'  then e.id end) as completed_enrollments,
  count(distinct case when e.status = 'dropped'    then e.id end) as dropped_enrollments,

  round(
    count(distinct case when e.status = 'completed' then e.id end)::numeric
    / nullif(count(distinct e.id), 0) * 100,
    1
  ) as completion_rate,

  -- D7 adherence: of enrollments old enough (or finished), how many reached day 7
  round(
    count(distinct case
      when exists (
        select 1 from public.daily_checkins dc
        where dc.enrollment_id = e.id and dc.day_number >= 7
      ) then e.id
    end)::numeric
    / nullif(
        count(distinct case
          when greatest(current_date - e.started_at::date, 0) >= 7
               or e.status in ('completed', 'dropped')
          then e.id
        end),
        0
      ) * 100,
    1
  ) as d7_adherence,

  -- D14 adherence
  round(
    count(distinct case
      when exists (
        select 1 from public.daily_checkins dc
        where dc.enrollment_id = e.id and dc.day_number >= 14
      ) then e.id
    end)::numeric
    / nullif(
        count(distinct case
          when greatest(current_date - e.started_at::date, 0) >= 14
               or e.status in ('completed', 'dropped')
          then e.id
        end),
        0
      ) * 100,
    1
  ) as d14_adherence,

  round(avg(s.current_streak), 1) as avg_current_streak,
  max(s.longest_streak)           as max_streak

from public.cohorts c
join public.programs p
  on p.id = c.program_id
left join public.enrollments e
  on e.cohort_id = c.id
  and e.status in ('active', 'completed', 'dropped', 'paused')
left join public.streaks s
  on s.enrollment_id = e.id
group by
  c.id, c.name,
  p.slug, p.name, p.duration_days,
  c.start_date, c.end_date, c.status, c.current_members;

-- Unique index required for REFRESH CONCURRENTLY
create unique index on public.mv_cohort_analytics(cohort_id);

-- ============================================
-- 2. PROGRAM ANALYTICS
-- ============================================
create materialized view public.mv_program_analytics as
select
  p.id           as program_id,
  p.slug,
  p.name,
  p.duration_days,
  p.price_vnd,

  count(distinct e.id) as total_enrollments,

  count(distinct case when e.status = 'completed' then e.id end) as total_completed,

  -- Completion rate: completed / (completed + dropped) — excludes still-active
  round(
    count(distinct case when e.status = 'completed' then e.id end)::numeric
    / nullif(
        count(distinct case when e.status in ('completed', 'dropped') then e.id end),
        0
      ) * 100,
    1
  ) as overall_completion_rate,

  coalesce(sum(e.amount_paid), 0) as total_revenue,

  -- Visible change rate: mid-program overall_progress >= 6
  round(
    count(distinct case when mpr.overall_progress >= 6 then mpr.id end)::numeric
    / nullif(count(distinct mpr.id), 0) * 100,
    1
  ) as visible_change_rate,

  -- NPS score (average raw)
  round(avg(mpr.recommendation_score), 1) as avg_nps_score,

  -- NPS: (promoters >= 9) - (detractors <= 6) / total respondents × 100
  round(
    (
      count(case when mpr.recommendation_score >= 9 then 1 end)::numeric
      - count(case when mpr.recommendation_score <= 6 then 1 end)::numeric
    )
    / nullif(count(case when mpr.recommendation_score is not null then 1 end), 0)
    * 100,
    0
  ) as nps

from public.programs p
left join public.enrollments e
  on e.program_id = p.id
  and e.status != 'trial'
left join public.mid_program_reflections mpr
  on mpr.enrollment_id = e.id
group by p.id, p.slug, p.name, p.duration_days, p.price_vnd;

create unique index on public.mv_program_analytics(program_id);

-- ============================================
-- 3. UPGRADE FUNNEL
-- ============================================
create materialized view public.mv_upgrade_funnel as
with completers as (
  select e.user_id, p.slug as completed_slug
  from public.enrollments e
  join public.programs p on p.id = e.program_id
  where e.status = 'completed'
)
select
  '21_to_6w'                                                                   as path,
  count(distinct case when completed_slug = 'bodix-21' then user_id end)       as completers,
  count(distinct case
    when completed_slug = 'bodix-21'
     and user_id in (select user_id from completers where completed_slug = 'bodix-6w')
    then user_id
  end)                                                                          as upgraded,
  round(
    count(distinct case
      when completed_slug = 'bodix-21'
       and user_id in (select user_id from completers where completed_slug = 'bodix-6w')
      then user_id
    end)::numeric
    / nullif(
        count(distinct case when completed_slug = 'bodix-21' then user_id end),
        0
      ) * 100,
    1
  )                                                                             as upgrade_rate
from completers

union all

select
  '6w_to_12w',
  count(distinct case when completed_slug = 'bodix-6w'  then user_id end),
  count(distinct case
    when completed_slug = 'bodix-6w'
     and user_id in (select user_id from completers where completed_slug = 'bodix-12w')
    then user_id
  end),
  round(
    count(distinct case
      when completed_slug = 'bodix-6w'
       and user_id in (select user_id from completers where completed_slug = 'bodix-12w')
      then user_id
    end)::numeric
    / nullif(
        count(distinct case when completed_slug = 'bodix-6w' then user_id end),
        0
      ) * 100,
    1
  )
from completers;

-- mv_upgrade_funnel has only 2 rows — no unique index needed;
-- use plain REFRESH (not concurrently) in refresh function below.
create unique index on public.mv_upgrade_funnel(path);

-- ============================================
-- 4. MONTHLY REVENUE
-- ============================================
create materialized view public.mv_monthly_revenue as
select
  date_trunc('month', e.paid_at)                                                    as month,
  count(distinct e.id)                                                              as total_purchases,
  coalesce(sum(e.amount_paid), 0)                                                   as total_revenue,
  round(coalesce(sum(e.amount_paid), 0)::numeric / nullif(count(distinct e.id), 0), 0)
                                                                                    as avg_order_value,

  -- Referral-driven purchases
  count(distinct case when e.referral_code_id is not null then e.id end)            as referral_purchases,
  coalesce(sum(case when e.referral_code_id is not null then e.amount_paid else 0 end), 0)
                                                                                    as referral_revenue,
  round(
    count(distinct case when e.referral_code_id is not null then e.id end)::numeric
    / nullif(count(distinct e.id), 0) * 100,
    1
  )                                                                                 as referral_share_percent,

  -- Discount given out via referral codes
  coalesce(sum(e.referral_discount_amount), 0)                                      as total_discount_given

from public.enrollments e
join public.programs p on p.id = e.program_id
where e.paid_at is not null
  and e.status != 'trial'
group by date_trunc('month', e.paid_at)
order by month desc;

create unique index on public.mv_monthly_revenue(month);

-- ============================================
-- 5. REFRESH FUNCTION + CRON
-- ============================================
create or replace function public.refresh_analytics_views()
returns void as $$
begin
  -- mv_cohort_analytics and mv_program_analytics have unique indexes → CONCURRENTLY
  refresh materialized view concurrently public.mv_cohort_analytics;
  refresh materialized view concurrently public.mv_program_analytics;
  -- mv_upgrade_funnel and mv_monthly_revenue also have unique indexes → CONCURRENTLY
  refresh materialized view concurrently public.mv_upgrade_funnel;
  refresh materialized view concurrently public.mv_monthly_revenue;
end;
$$ language plpgsql security definer;

-- Schedule: refresh every 2 hours via pg_cron (must be enabled in Supabase Dashboard → Extensions)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'refresh-analytics',
      '0 */2 * * *',
      'select public.refresh_analytics_views()'
    );
  end if;
end $$;
