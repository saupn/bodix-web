-- Migration: 004_create_notifications
-- Bảng notifications cho tất cả các kênh: email, zalo, push, in_app

create table public.notifications (
  id          uuid         primary key default gen_random_uuid(),
  user_id     uuid         not null references public.profiles(id),
  type        text         not null,   -- 'trial_expired', 'trial_reminder_24h', 'trial_reminder_6h', ...
  channel     text         not null
    check (channel in ('email', 'zalo', 'push', 'in_app')),
  title       text,
  content     text,
  metadata    jsonb        not null default '{}',
  is_read     boolean      not null default false,
  sent_at     timestamptz,
  read_at     timestamptz,
  created_at  timestamptz  not null default now()
);

alter table public.notifications enable row level security;

-- User chỉ đọc và update (mark as read) notification của mình
create policy "Users view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

-- Indexes
-- Unread count (dùng trên dashboard badge)
create index idx_notifications_user_unread
  on public.notifications(user_id)
  where is_read = false;

-- Dedup queries trong Edge Function: (user_id, type, created_at)
create index idx_notifications_user_type_created
  on public.notifications(user_id, type, created_at desc);

-- Feed queries: (user_id, created_at) cho danh sách thông báo
create index idx_notifications_user_created
  on public.notifications(user_id, created_at desc);
