-- 063_genome_signal_patterns.sql
-- Port low_feeling_trend + downgrade_pattern từ dropout-scanner (đã deprecate)
-- vào genome SQL, với cách tính điểm KHÁC nhau theo triết lý completion-first:
--   • low_feeling_trend  → CỘNG +15 risk_score (cảnh báo thật).
--   • downgrade_pattern  → CHỈ GHI NHẬN, KHÔNG cộng điểm (chọn Light là hành vi tốt,
--                          chỉ học tương quan, không phạt).
--   • BỎ +5 đang cộng cho mode-light-hôm-nay trong risk_score (cùng triết lý).
-- Thêm 2 cột quan sát vào enrollment_daily: recent_avg_feeling, recent_all_light.
--
-- create or replace 2 hàm của 062 — KHÔNG sửa file 062 đã push.
-- Áp dụng thủ công: supabase db push (KHÔNG dùng MCP apply_migration).
-- Rollback: supabase/rollbacks/rollback_063_genome_signal_patterns.sql (manual).

begin;

-- 1. Cột quan sát (idempotent). Không cộng điểm — chỉ để dashboard thấy xu hướng.
alter table public.enrollment_daily
  add column if not exists recent_avg_feeling numeric,
  add column if not exists recent_all_light  boolean;

comment on column public.enrollment_daily.recent_avg_feeling is
  'Avg feeling 5 buổi gần nhất; NULL nếu <3 buổi có feeling (tránh nhiễu). Nuôi low_feeling_trend.';
comment on column public.enrollment_daily.recent_all_light is
  '>=3 buổi gần nhất toàn light/recovery/easy. Nuôi downgrade_pattern (KHÔNG phạt điểm).';

-- 2. Snapshot: thêm lateral 5 buổi gần nhất → 2 cột mới; đổi công thức risk
--    (bỏ +5 mode-light hôm nay, thêm +15 low_feeling_trend).
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
    on_rescue, nudges_sent_today, last_nudge_led_to_checkin,
    recent_avg_feeling, recent_all_light
  )
  select
    p_date,
    e.id,
    e.user_id,
    e.cohort_id,
    e.program_id,
    case
      when e.started_at is not null
        then greatest(1, (p_date - (e.started_at at time zone 'Asia/Ho_Chi_Minh')::date) + 1)
      else nullif(e.current_day, 0)
    end as program_day,
    e.status,
    coalesce(dc.mode is not null and dc.mode <> 'skip', false) as checked_in,
    dc.mode,
    dc.feeling,
    case when dc.completed_at is not null
      then extract(hour from (dc.completed_at at time zone 'Asia/Ho_Chi_Minh'))::int
      else null end as completed_hour_vn,
    coalesce(s.current_streak, 0),
    case when s.last_checkin_date is not null
      then (p_date - s.last_checkin_date) else null end as days_since_last_checkin,
    case when s.last_checkin_date is not null
      then greatest(0, (p_date - s.last_checkin_date)) else 0 end as consecutive_missed,
    coalesce(ri.has_pending, false) as on_rescue,
    coalesce(nz.cnt, 0) as nudges_sent_today,
    nz.last_led as last_nudge_led_to_checkin,
    -- recent_avg_feeling: chỉ tính khi có >=3 buổi có feeling (giống ngưỡng cũ)
    case when rc.feeling_cnt >= 3 then round(rc.avg_feeling, 2) else null end as recent_avg_feeling,
    -- recent_all_light: >=3 buổi gần nhất và TẤT CẢ thuộc light/recovery/easy
    coalesce(rc.total_cnt >= 3 and rc.soft_cnt = rc.total_cnt, false) as recent_all_light
  from public.enrollments e
  left join public.streaks s on s.enrollment_id = e.id
  left join lateral (
    select dc.mode, dc.feeling, dc.completed_at
    from public.daily_checkins dc
    where dc.enrollment_id = e.id and dc.workout_date = p_date
    order by dc.completed_at desc nulls last
    limit 1
  ) dc on true
  left join lateral (
    select bool_or(ri.outcome = 'pending') as has_pending
    from public.rescue_interventions ri
    where ri.enrollment_id = e.id
  ) ri on true
  left join lateral (
    select count(*) as cnt,
           (array_agg(nl.led_to_checkin order by nl.sent_at desc))[1] as last_led
    from public.nudge_logs nl
    where nl.enrollment_id = e.id
      and (nl.sent_at at time zone 'Asia/Ho_Chi_Minh')::date = p_date
  ) nz on true
  left join lateral (
    -- 5 buổi check-in gần nhất (mọi mode kể cả skip) để tính xu hướng
    select
      avg(l.feeling) filter (where l.feeling is not null)           as avg_feeling,
      count(l.feeling) filter (where l.feeling is not null)         as feeling_cnt,
      count(*)                                                      as total_cnt,
      count(*) filter (where l.mode in ('light','recovery','easy')) as soft_cnt
    from (
      select dc2.mode, dc2.feeling
      from public.daily_checkins dc2
      where dc2.enrollment_id = e.id
      order by dc2.workout_date desc
      limit 5
    ) l
  ) rc on true
  where e.status = 'active'
  on conflict (enrollment_id, snapshot_date) do update set
    program_day               = excluded.program_day,
    status                    = excluded.status,
    checked_in                = excluded.checked_in,
    mode                      = excluded.mode,
    feeling                   = excluded.feeling,
    completed_hour_vn         = excluded.completed_hour_vn,
    current_streak            = excluded.current_streak,
    days_since_last_checkin   = excluded.days_since_last_checkin,
    consecutive_missed        = excluded.consecutive_missed,
    on_rescue                 = excluded.on_rescue,
    nudges_sent_today         = excluded.nudges_sent_today,
    last_nudge_led_to_checkin = excluded.last_nudge_led_to_checkin,
    recent_avg_feeling        = excluded.recent_avg_feeling,
    recent_all_light          = excluded.recent_all_light;

  get diagnostics v_rows = row_count;

  -- Risk theo luật. ĐỔI so với 062:
  --   - BỎ: +5 khi mode hôm nay ∈ (light/easy/recovery).
  --   - THÊM: +15 khi low_feeling_trend (recent_avg_feeling < 2.0, đã đủ >=3 buổi).
  -- downgrade_pattern KHÔNG xuất hiện ở đây (chủ ý không phạt điểm).
  update public.enrollment_daily ed set
    risk_score = least(100, (
        case when ed.consecutive_missed >= 1 then 25 else 0 end
      + case when ed.consecutive_missed >= 2 then 25 else 0 end
      + case when ed.consecutive_missed >= 3 then 25 else 0 end
      + case when ed.feeling is not null and ed.feeling <= 2 then 15 else 0 end
      + case when ed.last_nudge_led_to_checkin is false then 10 else 0 end
      + case when ed.recent_avg_feeling is not null and ed.recent_avg_feeling < 2.0 then 15 else 0 end
    )),
    risk_band = case
      when (
        case when ed.consecutive_missed >= 1 then 25 else 0 end
      + case when ed.consecutive_missed >= 2 then 25 else 0 end
      + case when ed.consecutive_missed >= 3 then 25 else 0 end
      + case when ed.feeling is not null and ed.feeling <= 2 then 15 else 0 end
      + case when ed.last_nudge_led_to_checkin is false then 10 else 0 end
      + case when ed.recent_avg_feeling is not null and ed.recent_avg_feeling < 2.0 then 15 else 0 end
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

-- 3. Emit: giữ nguyên missed_* + d3/d7/d14_risk; THÊM low_feeling_trend + downgrade_pattern.
create or replace function public.bodix_emit_dropout_signals(p_date date default (now() at time zone 'Asia/Ho_Chi_Minh')::date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int := 0;
begin
  -- tín hiệu bỏ buổi theo số ngày
  insert into public.dropout_signals (enrollment_id, user_id, signal_type, risk_score, signal_date, details)
  select ed.enrollment_id, ed.user_id,
         case
           when ed.consecutive_missed >= 3 then 'missed_3_plus_days'
           when ed.consecutive_missed = 2 then 'missed_2_days'
           else 'missed_1_day'
         end,
         ed.risk_score, p_date,
         jsonb_build_object('program_day', ed.program_day, 'consecutive_missed', ed.consecutive_missed)
  from public.enrollment_daily ed
  where ed.snapshot_date = p_date
    and ed.consecutive_missed >= 1
    and not exists (
      select 1 from public.dropout_signals d
      where d.enrollment_id = ed.enrollment_id and d.signal_date = p_date
        and d.signal_type in ('missed_1_day','missed_2_days','missed_3_plus_days')
    );
  get diagnostics v_rows = row_count;

  -- tín hiệu vách đá D3/D7/D14 khi risk cao đúng các ngày bản lề
  insert into public.dropout_signals (enrollment_id, user_id, signal_type, risk_score, signal_date, details)
  select ed.enrollment_id, ed.user_id,
         case ed.program_day when 3 then 'd3_risk' when 7 then 'd7_risk' else 'd14_risk' end,
         ed.risk_score, p_date,
         jsonb_build_object('program_day', ed.program_day)
  from public.enrollment_daily ed
  where ed.snapshot_date = p_date
    and ed.program_day in (3,7,14)
    and ed.risk_band in ('medium','high')
    and not exists (
      select 1 from public.dropout_signals d
      where d.enrollment_id = ed.enrollment_id and d.signal_date = p_date
        and d.signal_type in ('d3_risk','d7_risk','d14_risk')
    );

  -- low_feeling_trend: avg feeling 5 buổi < 2.0 (recent_avg_feeling not null = đã đủ >=3 buổi).
  insert into public.dropout_signals (enrollment_id, user_id, signal_type, risk_score, signal_date, details)
  select ed.enrollment_id, ed.user_id, 'low_feeling_trend', ed.risk_score, p_date,
         jsonb_build_object('program_day', ed.program_day, 'recent_avg_feeling', ed.recent_avg_feeling)
  from public.enrollment_daily ed
  where ed.snapshot_date = p_date
    and ed.recent_avg_feeling is not null
    and ed.recent_avg_feeling < 2.0
    and not exists (
      select 1 from public.dropout_signals d
      where d.enrollment_id = ed.enrollment_id and d.signal_date = p_date
        and d.signal_type = 'low_feeling_trend'
    );

  -- downgrade_pattern: >=3 buổi gần nhất toàn light/recovery/easy. CHỈ ghi nhận (không phạt điểm).
  insert into public.dropout_signals (enrollment_id, user_id, signal_type, risk_score, signal_date, details)
  select ed.enrollment_id, ed.user_id, 'downgrade_pattern', ed.risk_score, p_date,
         jsonb_build_object('program_day', ed.program_day, 'recent_all_light', ed.recent_all_light)
  from public.enrollment_daily ed
  where ed.snapshot_date = p_date
    and ed.recent_all_light = true
    and not exists (
      select 1 from public.dropout_signals d
      where d.enrollment_id = ed.enrollment_id and d.signal_date = p_date
        and d.signal_type = 'downgrade_pattern'
    );

  return v_rows;
end;
$$;

commit;
