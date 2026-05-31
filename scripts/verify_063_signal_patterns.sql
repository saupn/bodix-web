-- verify_063_signal_patterns.sql
-- Chạy SAU khi `supabase db push` migration 063. In PASS/FAIL.
-- An toàn chạy nhiều lần (test seed nằm trong transaction tự rollback).

-- 1. Hai cột quan sát tồn tại
select case when count(*) = 2 then 'PASS: có recent_avg_feeling + recent_all_light'
  else 'FAIL: thiếu cột quan sát' end
from information_schema.columns
where table_name = 'enrollment_daily'
  and column_name in ('recent_avg_feeling','recent_all_light');

-- 2. enum dropout_signals chấp nhận 2 signal_type port (constraint cũ đã có sẵn)
select case when count(*) = 2 then 'PASS: enum có low_feeling_trend + downgrade_pattern'
  else 'WARN: kiểm CHECK constraint signal_type' end
from (
  select unnest(array['low_feeling_trend','downgrade_pattern']) as t
) x
where exists (
  select 1 from pg_constraint c
  join pg_class cl on cl.oid = c.conrelid
  where cl.relname = 'dropout_signals' and pg_get_constraintdef(c.oid) ilike '%' || x.t || '%'
);

-- 3. Risk KHÔNG đổi với downgrade-only + low_feeling_trend ghi đúng (seed rollback)
begin;
do $$
declare
  v_uid uuid; v_pid uuid;
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  e_dg uuid;   -- downgrade-only (toàn light, feeling ok, không miss)
  e_lf uuid;   -- low feeling trend (3 buổi feeling 1)
  r record; v_fail int := 0; v_sig int;
begin
  select id into v_uid from public.profiles limit 1;
  select id into v_pid from public.programs limit 1;
  if v_uid is null or v_pid is null then
    raise notice 'SKIP mục 3: cần >=1 profile và >=1 program.'; return;
  end if;

  insert into public.enrollments (user_id, program_id, status, started_at, current_day)
    values (v_uid, v_pid, 'active', (v_today - 5)::timestamptz, 5) returning id into e_dg;
  insert into public.enrollments (user_id, program_id, status, started_at, current_day)
    values (v_uid, v_pid, 'active', (v_today - 5)::timestamptz, 5) returning id into e_lf;

  insert into public.streaks (enrollment_id, user_id, current_streak, last_checkin_date)
    values (e_dg, v_uid, 4, v_today), (e_lf, v_uid, 4, v_today);

  -- downgrade-only: 3 buổi light feeling 4
  insert into public.daily_checkins (enrollment_id, user_id, day_number, workout_date, mode, feeling, completed_at)
    values (e_dg, v_uid, 3, v_today - 2, 'light', 4, now()),
           (e_dg, v_uid, 4, v_today - 1, 'light', 4, now()),
           (e_dg, v_uid, 5, v_today,     'light', 4, now());

  -- low feeling trend: 3 buổi hard feeling 1 (avg 1.0 < 2.0)
  insert into public.daily_checkins (enrollment_id, user_id, day_number, workout_date, mode, feeling, completed_at)
    values (e_lf, v_uid, 3, v_today - 2, 'hard', 1, now()),
           (e_lf, v_uid, 4, v_today - 1, 'hard', 1, now()),
           (e_lf, v_uid, 5, v_today,     'hard', 1, now());

  perform public.bodix_run_genome_daily(v_today);

  -- 3a. downgrade-only KHÔNG thổi điểm → risk_score = 0, recent_all_light = true
  select risk_score, recent_all_light into r from public.enrollment_daily
    where enrollment_id = e_dg and snapshot_date = v_today;
  if r.risk_score = 0 and r.recent_all_light is true then
    raise notice 'PASS 3a: downgrade-only score=0, recent_all_light=true (không phạt điểm)';
  else raise warning 'FAIL 3a: score=% (≠0), recent_all_light=%', r.risk_score, r.recent_all_light; v_fail := v_fail + 1; end if;

  -- 3b. downgrade_pattern signal ĐƯỢC ghi cho e_dg
  select count(*) into v_sig from public.dropout_signals
    where enrollment_id = e_dg and signal_date = v_today and signal_type = 'downgrade_pattern';
  if v_sig = 1 then raise notice 'PASS 3b: downgrade_pattern signal ghi đúng 1 lần';
  else raise warning 'FAIL 3b: downgrade_pattern signal = % (≠1)', v_sig; v_fail := v_fail + 1; end if;

  -- 3c. low_feeling_trend: +15 điểm và signal ghi cho e_lf
  select risk_score into r from public.enrollment_daily
    where enrollment_id = e_lf and snapshot_date = v_today;
  -- e_lf: không miss, feeling hôm nay=1 (+15), low_feeling_trend (+15) = 30
  if r.risk_score = 30 then raise notice 'PASS 3c: low_feeling score=30 (feeling hôm nay 15 + trend 15)';
  else raise warning 'FAIL 3c: low_feeling score=% (≠30)', r.risk_score; v_fail := v_fail + 1; end if;

  select count(*) into v_sig from public.dropout_signals
    where enrollment_id = e_lf and signal_date = v_today and signal_type = 'low_feeling_trend';
  if v_sig = 1 then raise notice 'PASS 3d: low_feeling_trend signal ghi đúng 1 lần';
  else raise warning 'FAIL 3d: low_feeling_trend signal = % (≠1)', v_sig; v_fail := v_fail + 1; end if;

  -- 3e. Idempotent: chạy lần 2 KHÔNG nhân đôi signal
  perform public.bodix_run_genome_daily(v_today);
  select count(*) into v_sig from public.dropout_signals
    where enrollment_id = e_lf and signal_date = v_today and signal_type = 'low_feeling_trend';
  if v_sig = 1 then raise notice 'PASS 3e: signal không nhân đôi sau 2 lần chạy';
  else raise warning 'FAIL 3e: low_feeling_trend = % sau 2 lần (≠1)', v_sig; v_fail := v_fail + 1; end if;

  if v_fail = 0 then raise notice '✅ VERIFY 063 PASS'; else raise warning '❌ % mục FAIL', v_fail; end if;
end $$;
rollback;
