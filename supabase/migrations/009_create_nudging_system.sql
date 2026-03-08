-- Migration: 007_create_nudging_system
-- Requires: 003_create_program_engine (enrollments), 005_create_completion_engine

-- ============================================
-- 1. NOTIFICATION PREFERENCES (user chọn kênh nhận thông báo)
-- ============================================
create table if not exists public.notification_preferences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  morning_reminder boolean default true,          -- nhắc sáng
  evening_confirmation boolean default true,      -- nhắc tối
  rescue_messages boolean default true,           -- tin nhắn cứu
  community_updates boolean default true,         -- cập nhật cohort
  marketing_emails boolean default false,         -- email marketing
  preferred_channel text default 'email' check (preferred_channel in ('email', 'zalo', 'both')),
  morning_time time default '07:00',              -- giờ nhắc sáng (local time)
  evening_time time default '21:00',              -- giờ nhắc tối (local time)
  timezone text default 'Asia/Ho_Chi_Minh',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 2. NUDGE LOG (lịch sử gửi nudge)
-- ============================================
create table if not exists public.nudge_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  enrollment_id uuid references public.enrollments(id),
  nudge_type text not null check (nudge_type in (
    'morning_reminder',        -- nhắc sáng: "Hôm nay là ngày X, sẵn sàng chưa?"
    'evening_confirmation',    -- nhắc tối: "Bạn đã hoàn thành hôm nay chưa? Check-in nào!"
    'rescue_soft',             -- rescue nhẹ (1 ngày miss): "Mọi thứ ổn chứ? Hôm nay thử Light mode nhé"
    'rescue_urgent',           -- rescue khẩn (2 ngày miss): "Đừng bỏ cuộc! 10 phút Recovery cũng được"
    'rescue_critical',         -- rescue nghiêm trọng (3+ ngày miss): "Chúng tôi nhớ bạn. Quay lại bất cứ lúc nào"
    'milestone_celebration',   -- chúc mừng milestone
    'cohort_motivation',       -- "X người trong đợt bạn đã tập hôm nay!"
    'trial_reminder',          -- nhắc trial sắp hết
    'trial_expired',           -- trial đã hết
    'week_review'              -- nhắc review cuối tuần
  )),
  channel text not null check (channel in ('email', 'zalo', 'push', 'in_app')),
  content_template text,        -- template ID hoặc nội dung
  content_variables jsonb,      -- biến thay thế trong template
  sent_at timestamptz default now(),
  delivered boolean default false,
  opened boolean default false,
  clicked boolean default false,
  led_to_checkin boolean default false,  -- user có check-in trong 24h sau nudge không
  created_at timestamptz default now()
);

-- ============================================
-- 3. RESCUE INTERVENTIONS (log can thiệp rescue)
-- ============================================
create table if not exists public.rescue_interventions (
  id uuid default gen_random_uuid() primary key,
  enrollment_id uuid references public.enrollments(id) not null,
  user_id uuid references public.profiles(id) not null,
  trigger_reason text not null check (trigger_reason in (
    'missed_2_days',
    'missed_3_plus_days',
    'high_risk_score',
    'low_feeling_sustained',
    'manual_coach'
  )),
  risk_score_at_trigger integer,
  action_taken text not null check (action_taken in (
    'switch_to_light',         -- tự động chuyển sang Light mode
    'suggest_recovery',        -- gợi ý Recovery day
    'reduce_to_minimum',       -- giảm xuống 10-15 phút tối thiểu
    'send_rescue_message',     -- gửi tin nhắn rescue
    'pause_program',           -- tạm dừng chương trình
    'coach_intervention'       -- coach can thiệp thủ công
  )),
  message_sent text,            -- nội dung message đã gửi
  outcome text check (outcome in (
    'user_returned',           -- user quay lại tập
    'user_continued_light',    -- user tiếp tục ở Light mode
    'user_paused',             -- user tạm dừng
    'user_dropped',            -- user bỏ hẳn
    'pending'                  -- chưa có kết quả
  )) default 'pending',
  outcome_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================
-- 4. A/B TEST VARIANTS (cho nudge optimization)
-- ============================================
create table if not exists public.ab_test_assignments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  test_name text not null,              -- 'morning_reminder_v2', 'rescue_message_tone'
  variant text not null,                -- 'control', 'variant_a', 'variant_b'
  assigned_at timestamptz default now(),

  unique(user_id, test_name)
);

-- ============================================
-- RLS POLICIES
-- ============================================
alter table public.notification_preferences enable row level security;
alter table public.nudge_logs enable row level security;
alter table public.rescue_interventions enable row level security;
alter table public.ab_test_assignments enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'notification_preferences' and policyname = 'Users manage own notification prefs'
  ) then
    create policy "Users manage own notification prefs" on public.notification_preferences
      for all using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'nudge_logs' and policyname = 'Users view own nudge logs'
  ) then
    create policy "Users view own nudge logs" on public.nudge_logs
      for select using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'rescue_interventions' and policyname = 'Users view own rescue interventions'
  ) then
    create policy "Users view own rescue interventions" on public.rescue_interventions
      for select using (auth.uid() = user_id);
  end if;
end $$;

-- ab_test: chỉ service_role quản lý
-- Không cần user policy

-- ============================================
-- INDEXES
-- ============================================
create index if not exists idx_nudge_logs_user on public.nudge_logs(user_id);
create index if not exists idx_nudge_logs_enrollment on public.nudge_logs(enrollment_id);
create index if not exists idx_nudge_logs_type_date on public.nudge_logs(nudge_type, sent_at);
create index if not exists idx_rescue_user on public.rescue_interventions(user_id);
create index if not exists idx_rescue_enrollment on public.rescue_interventions(enrollment_id);
create index if not exists idx_rescue_pending on public.rescue_interventions(enrollment_id) where outcome = 'pending';
create index if not exists idx_ab_test_user on public.ab_test_assignments(user_id, test_name);

-- ============================================
-- TRIGGER: Tự động tạo notification_preferences khi signup
-- ============================================
create or replace function public.handle_new_profile_prefs()
returns trigger as $$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'on_profile_created_prefs'
  ) then
    create trigger on_profile_created_prefs
      after insert on public.profiles
      for each row execute function public.handle_new_profile_prefs();
  end if;
end $$;
