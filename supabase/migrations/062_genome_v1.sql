-- 062_genome_v1.sql
-- Genome v1: tầng instrumentation cho dropout/completion.
-- Thêm bảng snapshot enrollment_daily (chất nền phân tích) + job đêm tính risk
-- và ghi tín hiệu vào bảng dropout_signals đã có sẵn.
-- KHÔNG gọi HTTP, KHÔNG trùng bất kỳ Vercel cron nào. Đây là task DB-internal.
-- Áp dụng thủ công: supabase db push (KHÔNG dùng MCP apply_migration).
-- Writer DUY NHẤT của dropout_signals: bodix_emit_dropout_signals. Edge function
-- dropout-scanner phải giữ trạng thái KHÔNG lên lịch để tránh double-write.

begin;

-- 1. Bảng snapshot: mỗi enrollment active, mỗi ngày một dòng.
create table if not exists public.enrollment_daily (
  id                     bigserial primary key,
  snapshot_date          date        not null,
  enrollment_id          uuid        not null references public.enrollments(id) on delete cascade,
  user_id                uuid        not null references public.profiles(id)    on delete cascade,
  cohort_id              uuid,
  program_id             uuid,
  program_day            int,                    -- ngày thứ mấy của chương trình (trục genome)
  status                 text        not null,
  checked_in             boolean     not null default false,
  mode                   text,                   -- hard/light/easy/recovery/review/skip/null
  feeling                int,                    -- 1..5 (null nếu không báo)
  completed_hour_vn      int,                    -- giờ check-in theo VN (proxy cho latency)
  current_streak         int         default 0,
  days_since_last_checkin int,
  consecutive_missed     int         default 0,
  on_rescue              boolean     default false,
  nudges_sent_today      int         default 0,
  last_nudge_led_to_checkin boolean,
  risk_score             int         default 0,  -- 0..100, rule-based
  risk_band              text,                   -- low/medium/high
  created_at             timestamptz default now(),
  unique (enrollment_id, snapshot_date)
);

create index if not exists idx_enrollment_daily_date     on public.enrollment_daily (snapshot_date);
create index if not exists idx_enrollment_daily_progday  on public.enrollment_daily (program_day);
create index if not exists idx_enrollment_daily_risk     on public.enrollment_daily (risk_band, snapshot_date);
create index if not exists idx_enrollment_daily_user     on public.enrollment_daily (user_id, snapshot_date);

-- RLS: chỉ admin đọc. Service role bỏ qua RLS nên cron vẫn ghi được.
alter table public.enrollment_daily enable row level security;

drop policy if exists enrollment_daily_admin_read on public.enrollment_daily;
create policy enrollment_daily_admin_read on public.enrollment_daily
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

-- 2. Hàm chụp snapshot 1 ngày cho mọi enrollment active.
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
    p_date,
    e.id,
    e.user_id,
    e.cohort_id,
    e.program_id,
    -- program_day: ưu tiên tính từ started_at, fallback current_day
    case
      when e.started_at is not null
        then greatest(1, (p_date - (e.started_at at time zone 'Asia/Ho_Chi_Minh')::date) + 1)
      else nullif(e.current_day, 0)
    end as program_day,
    e.status,
    -- checked_in: có dòng check-in trong ngày với mode khác skip
    coalesce(dc.mode is not null and dc.mode <> 'skip', false) as checked_in,
    dc.mode,
    dc.feeling,
    case when dc.completed_at is not null
      then extract(hour from (dc.completed_at at time zone 'Asia/Ho_Chi_Minh'))::int
      else null end as completed_hour_vn,
    coalesce(s.current_streak, 0),
    case when s.last_checkin_date is not null
      then (p_date - s.last_checkin_date) else null end as days_since_last_checkin,
    -- consecutive_missed: số ngày kể từ lần check-in gần nhất (proxy)
    case when s.last_checkin_date is not null
      then greatest(0, (p_date - s.last_checkin_date)) else 0 end as consecutive_missed,
    coalesce(ri.has_pending, false) as on_rescue,
    coalesce(nz.cnt, 0) as nudges_sent_today,
    nz.last_led as last_nudge_led_to_checkin
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
    last_nudge_led_to_checkin = excluded.last_nudge_led_to_checkin;

  get diagnostics v_rows = row_count;

  -- 3. Tính risk_score theo luật (đọc hiểu được, chưa ML). Cập nhật trên chính dòng vừa ghi.
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

-- 4. Hàm phát tín hiệu vào dropout_signals (bảng có sẵn). Tránh trùng trong ngày.
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

  return v_rows;
end;
$$;

-- 5. Hàm gói chạy hằng đêm.
create or replace function public.bodix_run_genome_daily(p_date date default (now() at time zone 'Asia/Ho_Chi_Minh')::date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.bodix_snapshot_enrollment_daily(p_date);
  perform public.bodix_emit_dropout_signals(p_date);
end;
$$;

commit;

-- 6. Lịch pg_cron: 23:30 VN = 16:30 UTC (chụp trọn ngày trước nửa đêm).
-- Chạy NGOÀI transaction. pg_cron chạy theo UTC.
-- DB-internal, không trùng Vercel cron nào.
create extension if not exists pg_cron;

select cron.unschedule('genome-daily')
where exists (select 1 from cron.job where jobname = 'genome-daily');

select cron.schedule('genome-daily', '30 16 * * *', $$ select public.bodix_run_genome_daily(); $$);
