-- genome_risk_test.sql
-- Test risk scoring của bodix_snapshot_enrollment_daily trên SCHEMA THẬT.
-- Chạy SAU khi `supabase db push` migration 062 + 063. TỰ ROLLBACK — không để lại dữ liệu.
-- (Trọng số phản ánh 063: bỏ +5 mode-light, thêm +15 low_feeling_trend.)
--
-- Dựng enrollment giả (dùng 1 profile + 1 program có sẵn để thoả FK), seed
-- streak/daily_checkins cho từng ca, chạy snapshot, so risk_score/risk_band với
-- kỳ vọng (khớp lib/genome/risk.ts). In PASS/FAIL rồi ROLLBACK.
--
-- Cách chạy: psql "$DATABASE_URL" -f scripts/genome_risk_test.sql

begin;

do $$
declare
  v_uid    uuid;
  v_pid    uuid;
  v_today  date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  e1 uuid; e2 uuid; e3 uuid; e4 uuid; e5 uuid;  -- miss1, miss2, miss3, miss1+lowfeeling-today, downgrade-only
  r record;
  v_fail int := 0;
begin
  select id into v_uid from public.profiles limit 1;
  select id into v_pid from public.programs limit 1;
  if v_uid is null or v_pid is null then
    raise notice 'SKIP: cần ít nhất 1 profile và 1 program để dựng enrollment giả.';
    return;
  end if;

  -- ── Dựng 4 enrollment active giả ────────────────────────────────────────
  insert into public.enrollments (user_id, program_id, status, started_at, current_day)
    values (v_uid, v_pid, 'active', (v_today - 5)::timestamptz, 5) returning id into e1;
  insert into public.enrollments (user_id, program_id, status, started_at, current_day)
    values (v_uid, v_pid, 'active', (v_today - 5)::timestamptz, 5) returning id into e2;
  insert into public.enrollments (user_id, program_id, status, started_at, current_day)
    values (v_uid, v_pid, 'active', (v_today - 5)::timestamptz, 5) returning id into e3;
  insert into public.enrollments (user_id, program_id, status, started_at, current_day)
    values (v_uid, v_pid, 'active', (v_today - 5)::timestamptz, 5) returning id into e4;
  insert into public.enrollments (user_id, program_id, status, started_at, current_day)
    values (v_uid, v_pid, 'active', (v_today - 5)::timestamptz, 5) returning id into e5;

  -- streak.last_checkin_date điều khiển consecutive_missed = today - last
  insert into public.streaks (enrollment_id, user_id, current_streak, last_checkin_date)
    values (e1, v_uid, 4, v_today - 1),   -- miss 1
           (e2, v_uid, 3, v_today - 2),   -- miss 2
           (e3, v_uid, 0, v_today - 3),   -- miss 3
           (e4, v_uid, 4, v_today - 1),   -- miss 1 + feeling thấp hôm nay
           (e5, v_uid, 4, v_today);       -- không miss; downgrade-only

  -- e4: check-in hôm nay feeling=2 (chỉ 1 buổi → recent_avg_feeling NULL, không low_trend)
  insert into public.daily_checkins (enrollment_id, user_id, day_number, workout_date, mode, feeling, completed_at)
    values (e4, v_uid, 5, v_today, 'light', 2, now());

  -- e5: 3 buổi gần nhất toàn light, feeling tốt (4) → recent_all_light=true, không low_trend, không miss
  insert into public.daily_checkins (enrollment_id, user_id, day_number, workout_date, mode, feeling, completed_at)
    values (e5, v_uid, 3, v_today - 2, 'light', 4, now()),
           (e5, v_uid, 4, v_today - 1, 'light', 4, now()),
           (e5, v_uid, 5, v_today,     'light', 4, now());

  -- ── Chạy snapshot cho hôm nay ───────────────────────────────────────────
  perform public.bodix_snapshot_enrollment_daily(v_today);

  -- ── Assert từng ca ──────────────────────────────────────────────────────
  -- e1: miss1 → score 25, band low
  select risk_score, risk_band into r from public.enrollment_daily where enrollment_id = e1 and snapshot_date = v_today;
  if r.risk_score = 25 and r.risk_band = 'low' then raise notice 'PASS e1 miss1: score=%, band=%', r.risk_score, r.risk_band;
  else raise warning 'FAIL e1 miss1: score=% (≠25), band=% (≠low)', r.risk_score, r.risk_band; v_fail := v_fail + 1; end if;

  -- e2: miss2 → score 50, band medium
  select risk_score, risk_band into r from public.enrollment_daily where enrollment_id = e2 and snapshot_date = v_today;
  if r.risk_score = 50 and r.risk_band = 'medium' then raise notice 'PASS e2 miss2: score=%, band=%', r.risk_score, r.risk_band;
  else raise warning 'FAIL e2 miss2: score=% (≠50), band=% (≠medium)', r.risk_score, r.risk_band; v_fail := v_fail + 1; end if;

  -- e3: miss3 → score 75, band high
  select risk_score, risk_band into r from public.enrollment_daily where enrollment_id = e3 and snapshot_date = v_today;
  if r.risk_score = 75 and r.risk_band = 'high' then raise notice 'PASS e3 miss3: score=%, band=%', r.risk_score, r.risk_band;
  else raise warning 'FAIL e3 miss3: score=% (≠75), band=% (≠high)', r.risk_score, r.risk_band; v_fail := v_fail + 1; end if;

  -- e4: miss1 + feeling2 hôm nay (light KHÔNG còn +5) → score 25+15 = 40, band medium
  select risk_score, risk_band into r from public.enrollment_daily where enrollment_id = e4 and snapshot_date = v_today;
  if r.risk_score = 40 and r.risk_band = 'medium' then raise notice 'PASS e4 miss1+feeling2: score=%, band=%', r.risk_score, r.risk_band;
  else raise warning 'FAIL e4 miss1+feeling2: score=% (≠40), band=% (≠medium)', r.risk_score, r.risk_band; v_fail := v_fail + 1; end if;

  -- e5: downgrade-only (toàn light, feeling ok, không miss) → score 0, band low,
  --     recent_all_light=true. KIỂM downgrade KHÔNG thổi điểm (trước 063 sẽ là 5).
  select risk_score, risk_band, recent_all_light, recent_avg_feeling into r
    from public.enrollment_daily where enrollment_id = e5 and snapshot_date = v_today;
  if r.risk_score = 0 and r.risk_band = 'low' and r.recent_all_light is true then
    raise notice 'PASS e5 downgrade-only: score=0, band=low, recent_all_light=true, avg=%', r.recent_avg_feeling;
  else
    raise warning 'FAIL e5 downgrade-only: score=% (≠0), band=% (≠low), recent_all_light=% (≠true)',
      r.risk_score, r.risk_band, r.recent_all_light; v_fail := v_fail + 1;
  end if;

  if v_fail = 0 then raise notice '✅ ALL RISK CASES PASS';
  else raise warning '❌ % case FAIL', v_fail; end if;
end $$;

rollback;
