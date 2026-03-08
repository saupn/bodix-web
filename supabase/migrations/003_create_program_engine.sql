-- Migration: 003_create_program_engine
-- Requires: profiles table (002 or earlier) and pg_cron extension for cleanup.
-- Prerequisite function: handle_updated_at() — created here if not already present.

-- ---------------------------------------------------------------------------
-- handle_updated_at trigger function (idempotent)
-- ---------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. programs
-- ---------------------------------------------------------------------------
create table public.programs (
  id             uuid         primary key default gen_random_uuid(),
  slug           text         unique not null,          -- 'bodix-21', 'bodix-6w', 'bodix-12w'
  name           text         not null,                 -- 'BodiX 21', 'BodiX 6W', 'BodiX 12W'
  description    text,
  duration_days  integer      not null,                 -- 21, 42, 84
  price_vnd      integer      not null,                 -- giá VND
  price_usd      numeric(10,2),                        -- giá USD (cho quốc tế sau)
  is_active      boolean      not null default true,
  sort_order     integer      not null default 0,
  features       jsonb        not null default '[]',    -- danh sách tính năng hiển thị
  created_at     timestamptz  not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. cohorts (đợt chạy chương trình)
-- ---------------------------------------------------------------------------
create table public.cohorts (
  id              uuid         primary key default gen_random_uuid(),
  program_id      uuid         not null references public.programs(id),
  name            text         not null,                -- 'Đợt 1 - Tháng 4/2026'
  start_date      date         not null,
  end_date        date         not null,
  max_members     integer      not null default 50,     -- giới hạn để tạo cảm giác nhóm nhỏ
  current_members integer      not null default 0,
  status          text         not null default 'upcoming'
    check (status in ('upcoming', 'active', 'completed')),
  created_at      timestamptz  not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. enrollments (user tham gia chương trình)
-- ---------------------------------------------------------------------------
create table public.enrollments (
  id                 uuid         primary key default gen_random_uuid(),
  user_id            uuid         not null references public.profiles(id),
  program_id         uuid         not null references public.programs(id),
  cohort_id          uuid         references public.cohorts(id),
  status             text         not null default 'trial'
    check (status in ('trial', 'pending_payment', 'active', 'paused', 'completed', 'dropped')),
  enrolled_at        timestamptz  not null default now(),
  paid_at            timestamptz,
  started_at         timestamptz,                       -- ngày thực sự bắt đầu tập
  completed_at       timestamptz,
  current_day        integer      not null default 0,   -- ngày hiện tại trong chương trình
  payment_method     text,
  payment_reference  text,
  amount_paid        integer,                           -- VND
  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. workout_templates (bài tập mẫu theo ngày)
-- ---------------------------------------------------------------------------
create table public.workout_templates (
  id                uuid         primary key default gen_random_uuid(),
  program_id        uuid         not null references public.programs(id),
  day_number        integer      not null,              -- ngày thứ mấy (1-21 / 1-42 / 1-84)
  week_number       integer      not null,              -- tuần thứ mấy
  day_of_week       integer      not null,              -- 1=T2, 2=T3, …, 7=CN
  workout_type      text         not null
    check (workout_type in ('main', 'recovery', 'flexible')),
  title             text         not null,              -- 'Ngày 1: Lower Body Basics'
  description       text,
  duration_minutes  integer      not null,              -- thời lượng (phút)
  hard_version      jsonb,                              -- { video_url, exercises: [...] }
  light_version     jsonb,                              -- { video_url, exercises: [...] }
  recovery_version  jsonb,                              -- { video_url, exercises: [...] }
  sort_order        integer      not null default 0,
  created_at        timestamptz  not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. trial_activities (theo dõi hoạt động trong 3 ngày trial)
-- ---------------------------------------------------------------------------
create table public.trial_activities (
  id             uuid         primary key default gen_random_uuid(),
  user_id        uuid         not null references public.profiles(id),
  program_id     uuid         not null references public.programs(id),
  activity_type  text         not null
    check (activity_type in ('view_program', 'view_workout', 'try_workout', 'complete_trial_day')),
  metadata       jsonb        not null default '{}',
  created_at     timestamptz  not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index idx_enrollments_user     on public.enrollments(user_id);
create index idx_enrollments_cohort   on public.enrollments(cohort_id);
create index idx_enrollments_status   on public.enrollments(status);

create index idx_workout_templates_program_day
  on public.workout_templates(program_id, day_number);

create index idx_cohorts_program_status
  on public.cohorts(program_id, status);

create index idx_trial_activities_user
  on public.trial_activities(user_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create trigger on_enrollments_updated
  before update on public.enrollments
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.programs         enable row level security;
alter table public.cohorts          enable row level security;
alter table public.enrollments      enable row level security;
alter table public.workout_templates enable row level security;
alter table public.trial_activities  enable row level security;

-- programs: public read
create policy "Anyone can view active programs"
  on public.programs for select
  using (is_active = true);

-- cohorts: public read (upcoming / active)
create policy "Anyone can view cohorts"
  on public.cohorts for select
  using (status in ('upcoming', 'active'));

-- enrollments: users see / modify only their own rows
create policy "Users view own enrollments"
  on public.enrollments for select
  using (auth.uid() = user_id);

create policy "Users insert own enrollments"
  on public.enrollments for insert
  with check (auth.uid() = user_id);

create policy "Users update own enrollments"
  on public.enrollments for update
  using (auth.uid() = user_id);

-- workout_templates: enrolled (trial or active) users only
create policy "Enrolled users view workouts"
  on public.workout_templates for select
  using (
    exists (
      select 1 from public.enrollments e
      where e.program_id = workout_templates.program_id
        and e.user_id    = auth.uid()
        and e.status     in ('trial', 'active')
    )
  );

-- trial_activities: users manage only their own rows
create policy "Users manage own trial activities"
  on public.trial_activities for all
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Seed: 3 chương trình BodiX
-- ---------------------------------------------------------------------------
insert into public.programs (slug, name, description, duration_days, price_vnd, sort_order, features) values
(
  'bodix-21',
  'BodiX 21',
  'Chương trình khởi đầu 21 ngày. Không đủ để thay đổi cơ thể, nhưng đủ để thay đổi cách bạn nhìn chính mình.',
  21,
  990000,
  1,
  '[
    "5 buổi chính + 1 Recovery mỗi tuần",
    "Không cần dụng cụ",
    "Hard & Light version cho mỗi buổi",
    "Hỗ trợ qua nhóm cohort",
    "Theo dõi streak hàng ngày"
  ]'
),
(
  'bodix-6w',
  'BodiX 6W',
  '6 tuần bắt đầu thấy kết quả. Sau khi có nền tảng kỷ luật từ BodiX 21, đây là lúc đẩy xa hơn.',
  42,
  1990000,
  2,
  '[
    "5 buổi chính + 1 Recovery mỗi tuần",
    "Cần thảm và tạ nhẹ",
    "Hard & Light version cho mỗi buổi",
    "Hỗ trợ qua nhóm cohort",
    "Theo dõi streak và review tuần",
    "Check-in ảnh tiến trình"
  ]'
),
(
  'bodix-12w',
  'BodiX 12W',
  '12 tuần hành trình lột xác. Cam kết dài hạn để tạo ra thay đổi thực sự về vóc dáng, sức khỏe và lối sống.',
  84,
  3490000,
  3,
  '[
    "5 buổi chính + 1 Recovery mỗi tuần",
    "Cần thảm, tạ, dây kháng lực",
    "Hard & Light version cho mỗi buổi",
    "Hỗ trợ qua nhóm cohort",
    "Theo dõi streak, review tuần và tháng",
    "Check-in ảnh tiến trình",
    "1-on-1 check-in tháng 2 và 3"
  ]'
);
