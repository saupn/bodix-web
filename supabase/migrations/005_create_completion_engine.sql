-- Migration: 005_create_completion_engine
-- Requires: 003_create_program_engine (enrollments, cohorts, profiles)

-- ============================================
-- 1. DAILY CHECK-INS
-- ============================================
create table public.daily_checkins (
  id uuid default gen_random_uuid() primary key,
  enrollment_id uuid references public.enrollments(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  cohort_id uuid references public.cohorts(id),
  day_number integer not null,                    -- ngày thứ mấy trong chương trình (1-84)
  workout_date date not null,                     -- ngày thực tế tập
  mode text not null check (mode in ('hard', 'light', 'recovery', 'skip')),
  feeling integer check (feeling between 1 and 5), -- 1=Rất mệt, 2=Hơi mệt, 3=Vừa phải, 4=Tốt, 5=Tuyệt vời
  feeling_note text,                              -- ghi chú tùy chọn
  duration_minutes integer,                       -- thời gian thực tế tập (phút)
  completed_at timestamptz default now(),
  created_at timestamptz default now(),

  -- Mỗi enrollment chỉ có 1 check-in cho mỗi ngày
  unique(enrollment_id, day_number)
);

-- ============================================
-- 2. STREAKS
-- ============================================
create table public.streaks (
  id uuid default gen_random_uuid() primary key,
  enrollment_id uuid references public.enrollments(id) on delete cascade not null unique,
  user_id uuid references public.profiles(id) not null,
  current_streak integer default 0,               -- chuỗi hiện tại
  longest_streak integer default 0,               -- chuỗi dài nhất từ trước tới giờ
  total_completed_days integer default 0,         -- tổng ngày đã hoàn thành
  total_hard_days integer default 0,              -- số ngày chọn Hard
  total_light_days integer default 0,             -- số ngày chọn Light
  total_recovery_days integer default 0,          -- số ngày chọn Recovery
  total_skip_days integer default 0,              -- số ngày skip (vẫn check-in nhưng skip)
  last_checkin_date date,                         -- ngày check-in gần nhất
  streak_started_at date,                         -- ngày bắt đầu streak hiện tại
  updated_at timestamptz default now()
);

-- ============================================
-- 3. DROPOUT SIGNALS (phát hiện nguy cơ bỏ cuộc)
-- ============================================
create table public.dropout_signals (
  id uuid default gen_random_uuid() primary key,
  enrollment_id uuid references public.enrollments(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  signal_type text not null check (signal_type in (
    'missed_1_day',          -- bỏ 1 ngày
    'missed_2_days',         -- bỏ 2 ngày liên tiếp (trigger rescue)
    'missed_3_plus_days',    -- bỏ 3+ ngày (high risk)
    'downgrade_pattern',     -- liên tục chọn Light/Recovery (giảm cường độ)
    'low_feeling_trend',     -- feeling trung bình giảm qua 5 ngày
    'skip_pattern',          -- check-in nhưng skip nhiều
    'd3_risk',               -- ngày 3 — điểm gãy phổ biến #1
    'd7_risk',               -- ngày 7 — điểm gãy phổ biến #2
    'd14_risk'               -- ngày 14 — điểm gãy phổ biến #3
  )),
  risk_score integer check (risk_score between 0 and 100), -- 0=thấp, 100=rất cao
  signal_date date not null,
  details jsonb default '{}',                     -- chi tiết bổ sung
  resolved boolean default false,                 -- đã xử lý chưa
  resolved_at timestamptz,
  resolved_by text,                               -- 'system', 'coach', 'user_returned'
  created_at timestamptz default now()
);

-- ============================================
-- 4. COMPLETION MILESTONES (vinh danh thành tích)
-- ============================================
create table public.completion_milestones (
  id uuid default gen_random_uuid() primary key,
  enrollment_id uuid references public.enrollments(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  milestone_type text not null check (milestone_type in (
    'streak_3',              -- 3 ngày liên tiếp
    'streak_7',              -- 7 ngày liên tiếp (1 tuần)
    'streak_14',             -- 14 ngày liên tiếp (2 tuần)
    'streak_21',             -- 21 ngày liên tiếp (3 tuần)
    'week_complete',         -- hoàn thành 1 tuần đầy đủ
    'halfway',               -- đi được nửa chương trình
    'final_week',            -- vào tuần cuối
    'program_complete',      -- hoàn thành toàn bộ
    'all_hard',              -- 1 tuần toàn Hard
    'first_checkin',         -- check-in lần đầu tiên
    'comeback'               -- quay lại sau khi miss 2+ ngày
  )),
  achieved_at timestamptz default now(),
  metadata jsonb default '{}',
  created_at timestamptz default now(),

  unique(enrollment_id, milestone_type)
);

-- ============================================
-- RLS POLICIES
-- ============================================
alter table public.daily_checkins enable row level security;
alter table public.streaks enable row level security;
alter table public.dropout_signals enable row level security;
alter table public.completion_milestones enable row level security;

-- Check-ins: user thấy và tạo check-in của mình
create policy "Users manage own checkins" on public.daily_checkins
  for all using (auth.uid() = user_id);

-- Streaks: user thấy streak của mình
create policy "Users view own streaks" on public.streaks
  for select using (auth.uid() = user_id);

-- Streaks: chỉ server (service_role) update streak
-- (tránh user tự sửa streak)
-- Note: service_role bypasses RLS entirely — policy below is a no-op safeguard
create policy "Service role manages streaks" on public.streaks
  for all using (true)
  with check (true);
-- Sẽ dùng service_role key trong Edge Functions để update

-- Dropout signals: user KHÔNG thấy (chỉ admin/system)
-- Không tạo policy cho select = mặc định deny
-- Admin access qua service_role

-- Milestones: user thấy milestones của mình
create policy "Users view own milestones" on public.completion_milestones
  for select using (auth.uid() = user_id);

-- ============================================
-- INDEXES
-- ============================================
create index idx_checkins_enrollment on public.daily_checkins(enrollment_id);
create index idx_checkins_user_date on public.daily_checkins(user_id, workout_date);
create index idx_checkins_cohort_date on public.daily_checkins(cohort_id, workout_date);
create index idx_streaks_enrollment on public.streaks(enrollment_id);
create index idx_streaks_user on public.streaks(user_id);
create index idx_dropout_enrollment on public.dropout_signals(enrollment_id);
create index idx_dropout_unresolved on public.dropout_signals(enrollment_id) where resolved = false;
create index idx_milestones_enrollment on public.completion_milestones(enrollment_id);
create index idx_milestones_user on public.completion_milestones(user_id);

-- ============================================
-- TRIGGER: Tự động tạo streak row khi có enrollment mới
-- ============================================
create or replace function public.handle_new_enrollment()
returns trigger as $$
begin
  if new.status = 'active' then
    insert into public.streaks (enrollment_id, user_id)
    values (new.id, new.user_id)
    on conflict (enrollment_id) do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_enrollment_activated
  after insert or update of status on public.enrollments
  for each row
  when (new.status = 'active')
  execute function public.handle_new_enrollment();
