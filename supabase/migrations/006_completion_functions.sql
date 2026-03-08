-- Migration: 006_completion_functions
-- Requires: 005_create_completion_engine (daily_checkins, streaks, dropout_signals)

-- ============================================
-- 1. Tính completion rate của 1 enrollment
-- ============================================
create or replace function public.get_completion_rate(p_enrollment_id uuid)
returns jsonb as $$
declare
  v_program_days integer;
  v_elapsed_days integer;
  v_completed_days integer;
  v_rate numeric;
  v_enrollment record;
begin
  -- Lấy thông tin enrollment + program
  select e.*, p.duration_days
  into v_enrollment
  from public.enrollments e
  join public.programs p on p.id = e.program_id
  where e.id = p_enrollment_id;

  if not found then
    return jsonb_build_object('error', 'Enrollment not found');
  end if;

  v_program_days := v_enrollment.duration_days;

  -- Số ngày đã trôi qua (từ ngày bắt đầu cohort tới hôm nay)
  v_elapsed_days := least(
    greatest(current_date - v_enrollment.started_at::date + 1, 0),
    v_program_days
  );

  -- Số ngày đã check-in (không tính skip)
  select count(*)
  into v_completed_days
  from public.daily_checkins
  where enrollment_id = p_enrollment_id
  and mode != 'skip';

  -- Tính rate
  if v_elapsed_days > 0 then
    v_rate := round((v_completed_days::numeric / v_elapsed_days) * 100, 1);
  else
    v_rate := 0;
  end if;

  return jsonb_build_object(
    'enrollment_id', p_enrollment_id,
    'program_days', v_program_days,
    'elapsed_days', v_elapsed_days,
    'completed_days', v_completed_days,
    'completion_rate', v_rate,
    'remaining_days', v_program_days - v_elapsed_days
  );
end;
$$ language plpgsql security definer;

-- ============================================
-- 2. Tính completion rate của toàn bộ cohort
-- ============================================
create or replace function public.get_cohort_completion(p_cohort_id uuid)
returns jsonb as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'cohort_id', p_cohort_id,
    'total_members', count(distinct e.user_id),
    'avg_completion_rate', round(avg(
      case
        when greatest(current_date - e.started_at::date + 1, 0) > 0
        then (
          select count(*)::numeric from public.daily_checkins dc
          where dc.enrollment_id = e.id and dc.mode != 'skip'
        ) / greatest(current_date - e.started_at::date + 1, 0) * 100
        else 0
      end
    ), 1),
    'today_completed', (
      select count(distinct dc.user_id)
      from public.daily_checkins dc
      join public.enrollments e2 on e2.id = dc.enrollment_id
      where e2.cohort_id = p_cohort_id
      and dc.workout_date = current_date
    ),
    'today_total', count(distinct e.user_id)
  )
  into v_result
  from public.enrollments e
  where e.cohort_id = p_cohort_id
  and e.status = 'active';

  return v_result;
end;
$$ language plpgsql security definer;

-- ============================================
-- 3. Tính risk score cho 1 enrollment
-- ============================================
create or replace function public.calculate_risk_score(p_enrollment_id uuid)
returns integer as $$
declare
  v_score integer := 0;
  v_streak record;
  v_recent_feelings numeric;
  v_recent_modes record;
  v_days_since_last integer;
  v_enrollment record;
begin
  -- Lấy enrollment
  select * into v_enrollment from public.enrollments where id = p_enrollment_id;
  if not found then return 0; end if;

  -- Lấy streak
  select * into v_streak from public.streaks where enrollment_id = p_enrollment_id;
  if not found then return 50; end if;

  -- 1. Số ngày kể từ check-in cuối cùng
  if v_streak.last_checkin_date is not null then
    v_days_since_last := current_date - v_streak.last_checkin_date;
  else
    v_days_since_last := greatest(current_date - v_enrollment.started_at::date, 0);
  end if;

  -- Tăng score theo ngày missed
  if v_days_since_last = 1 then v_score := v_score + 15;      -- bỏ 1 ngày
  elsif v_days_since_last = 2 then v_score := v_score + 35;    -- bỏ 2 ngày (nguy hiểm)
  elsif v_days_since_last >= 3 then v_score := v_score + 55;   -- bỏ 3+ ngày (rất nguy hiểm)
  end if;

  -- 2. Feeling trend (trung bình 5 check-in gần nhất)
  select avg(feeling)
  into v_recent_feelings
  from (
    select feeling from public.daily_checkins
    where enrollment_id = p_enrollment_id
    and feeling is not null
    order by day_number desc limit 5
  ) sub;

  if v_recent_feelings is not null and v_recent_feelings < 2.5 then
    v_score := v_score + 15;  -- feeling thấp liên tục
  end if;

  -- 3. Downgrade pattern (5 ngày gần nhất toàn light/recovery)
  select
    count(*) filter (where mode = 'light') as light_count,
    count(*) filter (where mode = 'recovery') as recovery_count,
    count(*) as total
  into v_recent_modes
  from (
    select mode from public.daily_checkins
    where enrollment_id = p_enrollment_id
    order by day_number desc limit 5
  ) sub;

  if v_recent_modes.total >= 3 and
     (v_recent_modes.light_count + v_recent_modes.recovery_count) = v_recent_modes.total then
    v_score := v_score + 10;  -- toàn light/recovery
  end if;

  -- 4. Điểm gãy phổ biến (D3, D7, D14)
  if v_enrollment.current_day in (3, 4) then v_score := v_score + 10;    -- D3 risk
  elsif v_enrollment.current_day in (7, 8) then v_score := v_score + 10;  -- D7 risk
  elsif v_enrollment.current_day in (14, 15) then v_score := v_score + 8; -- D14 risk
  end if;

  -- 5. Tổng skip nhiều
  if v_streak.total_skip_days > 3 then
    v_score := v_score + 10;
  end if;

  -- Cap at 100
  return least(v_score, 100);
end;
$$ language plpgsql security definer;

-- ============================================
-- 4. Tìm dropout points phổ biến nhất (cho admin analytics)
-- ============================================
create or replace function public.get_dropout_hotspots(p_program_id uuid)
returns table(day_number integer, dropout_count bigint, total_reached bigint, dropout_rate numeric) as $$
begin
  return query
  with day_series as (
    select generate_series(1, (select duration_days from public.programs where id = p_program_id)) as dn
  ),
  reached as (
    select ds.dn, count(distinct e.id) as total
    from day_series ds
    join public.enrollments e on e.program_id = p_program_id and e.status in ('active', 'completed', 'dropped')
    join public.daily_checkins dc on dc.enrollment_id = e.id and dc.day_number <= ds.dn
    group by ds.dn
  ),
  dropped_at as (
    select s.last_checkin_date, dc.day_number as last_day, s.enrollment_id
    from public.streaks s
    join public.enrollments e on e.id = s.enrollment_id
    join public.daily_checkins dc on dc.enrollment_id = s.enrollment_id
    where e.program_id = p_program_id
    and e.status = 'dropped'
    and dc.day_number = (select max(day_number) from public.daily_checkins where enrollment_id = s.enrollment_id)
  )
  select
    r.dn as day_number,
    coalesce((select count(*) from dropped_at d where d.last_day = r.dn), 0) as dropout_count,
    r.total as total_reached,
    case when r.total > 0 then
      round(coalesce((select count(*) from dropped_at d where d.last_day = r.dn), 0)::numeric / r.total * 100, 1)
    else 0 end as dropout_rate
  from reached r
  order by r.dn;
end;
$$ language plpgsql security definer;
