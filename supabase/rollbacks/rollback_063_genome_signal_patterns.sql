-- DO NOT RUN AUTOMATICALLY.
-- Rollback cho 063_genome_signal_patterns.sql.
-- Khôi phục 2 hàm về đúng bản 062 (mode-light +5, KHÔNG low_feeling_trend /
-- downgrade_pattern) và DROP 2 cột quan sát recent_avg_feeling / recent_all_light.
--
-- Migration 063 KHÔNG đụng dữ liệu (chỉ CREATE OR REPLACE FUNCTION + ADD COLUMN)
-- nên không có backup table. DROP COLUMN sẽ mất dữ liệu quan sát (chấp nhận khi
-- rollback). Snapshot đêm kế tiếp sẽ tái tạo phần còn lại.
--
-- Cách chạy: psql "$DATABASE_URL" -f supabase/rollbacks/rollback_063_genome_signal_patterns.sql

begin;

-- ── Safety check: các hàm genome phải tồn tại (đúng môi trường đã push 062/063) ──
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'bodix_snapshot_enrollment_daily')
     or not exists (select 1 from pg_proc where proname = 'bodix_emit_dropout_signals') then
    raise exception 'Rollback 063 hủy: thiếu hàm genome — sai môi trường?';
  end if;
end $$;

-- ── 1. Khôi phục snapshot về bản 062 (mode-light +5, không recent_*) ──────────
create or replace function public.bodix_snapshot_enrollment_daily(p_date date default (now() at time zone 'Asia/Ho_Chi_Minh')::date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
begin
  insert into public.enrollment_daily (
    snapshot_date, enrollment_id, user_id, cohort_id, program_id,
    program_day, status, checked_in, mode, feeling, completed_hour_vn,
    current_streak, days_since_last_checkin, consecutive_missed,
    on_rescue, nudges_sent_today, last_nudge_led_to_checkin
  )
  select
    p_date, e.id, e.user_id, e.cohort_id, e.program_id,
    case
      when e.started_at is not null
        then greatest(1, (p_date - (e.started_at at time zone 'Asia/Ho_Chi_Minh')::date) + 1)
      else nullif(e.current_day, 0)
    end,
    e.status,
    coalesce(dc.mode is not null and dc.mode <> 'skip', false),
    dc.mode, dc.feeling,
    case when dc.completed_at is not null
      then extract(hour from (dc.completed_at at time zone 'Asia/Ho_Chi_Minh'))::int else null end,
    coalesce(s.current_streak, 0),
    case when s.last_checkin_date is not null then (p_date - s.last_checkin_date) else null end,
    case when s.last_checkin_date is not null then greatest(0, (p_date - s.last_checkin_date)) else 0 end,
    coalesce(ri.has_pending, false),
    coalesce(nz.cnt, 0),
    nz.last_led
  from public.enrollments e
  left join public.streaks s on s.enrollment_id = e.id
  left join lateral (
    select dc.mode, dc.feeling, dc.completed_at
    from public.daily_checkins dc
    where dc.enrollment_id = e.id and dc.workout_date = p_date
    order by dc.completed_at desc nulls last limit 1
  ) dc on true
  left join lateral (
    select bool_or(ri.outcome = 'pending') as has_pending
    from public.rescue_interventions ri where ri.enrollment_id = e.id
  ) ri on true
  left join lateral (
    select count(*) as cnt,
           (array_agg(nl.led_to_checkin order by nl.sent_at desc))[1] as last_led
    from public.nudge_logs nl
    where nl.enrollment_id = e.id
      and (nl.sent_at at time zone 'Asia/Ho_Chi_Minh')::date = p_date
  ) nz on true
  where e.status = 'active'
  on conflict (enrollment_id, snapshot_date) do update set
    program_day = excluded.program_day, status = excluded.status,
    checked_in = excluded.checked_in, mode = excluded.mode, feeling = excluded.feeling,
    completed_hour_vn = excluded.completed_hour_vn, current_streak = excluded.current_streak,
    days_since_last_checkin = excluded.days_since_last_checkin,
    consecutive_missed = excluded.consecutive_missed, on_rescue = excluded.on_rescue,
    nudges_sent_today = excluded.nudges_sent_today,
    last_nudge_led_to_checkin = excluded.last_nudge_led_to_checkin;

  get diagnostics v_rows = row_count;

  update public.enrollment_daily ed set
    risk_score = least(100, (
        case when ed.consecutive_missed >= 1 then 25 else 0 end
      + case when ed.consecutive_missed >= 2 then 25 else 0 end
      + case when ed.consecutive_missed >= 3 then 25 else 0 end
      + case when ed.feeling is not null and ed.feeling <= 2 then 15 else 0 end
      + case when ed.last_nudge_led_to_checkin is false then 10 else 0 end
      + case when ed.mode in ('light','easy','recovery') then 5 else 0 end
    )),
    risk_band = case
      when (
        case when ed.consecutive_missed >= 1 then 25 else 0 end
      + case when ed.consecutive_missed >= 2 then 25 else 0 end
      + case when ed.consecutive_missed >= 3 then 25 else 0 end
      + case when ed.feeling is not null and ed.feeling <= 2 then 15 else 0 end
      + case when ed.last_nudge_led_to_checkin is false then 10 else 0 end
      + case when ed.mode in ('light','easy','recovery') then 5 else 0 end
      ) >= 60 then 'high'
      when (
        case when ed.consecutive_missed >= 1 then 25 else 0 end
      + case when ed.consecutive_missed >= 2 then 25 else 0 end
      + case when ed.feeling is not null and ed.feeling <= 2 then 15 else 0 end
      ) >= 30 then 'medium'
      else 'low'
    end
  where ed.snapshot_date = p_date;

  return v_rows;
end;
$$;

-- ── 2. Khôi phục emit về bản 062 (chỉ missed_* + d3/d7/d14_risk) ──────────────
create or replace function public.bodix_emit_dropout_signals(p_date date default (now() at time zone 'Asia/Ho_Chi_Minh')::date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int := 0;
begin
  insert into public.dropout_signals (enrollment_id, user_id, signal_type, risk_score, signal_date, details)
  select ed.enrollment_id, ed.user_id,
         case when ed.consecutive_missed >= 3 then 'missed_3_plus_days'
              when ed.consecutive_missed = 2 then 'missed_2_days'
              else 'missed_1_day' end,
         ed.risk_score, p_date,
         jsonb_build_object('program_day', ed.program_day, 'consecutive_missed', ed.consecutive_missed)
  from public.enrollment_daily ed
  where ed.snapshot_date = p_date and ed.consecutive_missed >= 1
    and not exists (select 1 from public.dropout_signals d
      where d.enrollment_id = ed.enrollment_id and d.signal_date = p_date
        and d.signal_type in ('missed_1_day','missed_2_days','missed_3_plus_days'));
  get diagnostics v_rows = row_count;

  insert into public.dropout_signals (enrollment_id, user_id, signal_type, risk_score, signal_date, details)
  select ed.enrollment_id, ed.user_id,
         case ed.program_day when 3 then 'd3_risk' when 7 then 'd7_risk' else 'd14_risk' end,
         ed.risk_score, p_date, jsonb_build_object('program_day', ed.program_day)
  from public.enrollment_daily ed
  where ed.snapshot_date = p_date and ed.program_day in (3,7,14)
    and ed.risk_band in ('medium','high')
    and not exists (select 1 from public.dropout_signals d
      where d.enrollment_id = ed.enrollment_id and d.signal_date = p_date
        and d.signal_type in ('d3_risk','d7_risk','d14_risk'));

  return v_rows;
end;
$$;

-- ── 3. Drop 2 cột quan sát ────────────────────────────────────────────────────
alter table public.enrollment_daily drop column if exists recent_avg_feeling;
alter table public.enrollment_daily drop column if exists recent_all_light;

-- ── 4. Verify ─────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'enrollment_daily'
               and column_name in ('recent_avg_feeling','recent_all_light')) then
    raise exception 'Rollback 063 FAIL: cột quan sát vẫn còn.';
  end if;
  raise notice 'Rollback 063 OK: đã khôi phục 062 + drop 2 cột.';
end $$;

commit;
