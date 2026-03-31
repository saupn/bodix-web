-- Migration: 036_create_buddy_pairs
-- Buddy system: mỗi user chỉ có 1 buddy per cohort.
-- user_a luôn là người chủ động chọn (hoặc nhỏ hơn khi auto-match).

drop table if exists public.buddy_pairs;

create table public.buddy_pairs (
  id         uuid        primary key default gen_random_uuid(),
  cohort_id  uuid        not null references public.cohorts(id),
  user_a     uuid        not null references public.profiles(id),
  user_b     uuid        not null references public.profiles(id),
  status     text        not null default 'active'
    check (status in ('active', 'dissolved')),
  matched_by text        not null default 'manual'
    check (matched_by in ('manual', 'auto', 'admin')),
  created_at timestamptz not null default now(),

  -- Mỗi user chỉ xuất hiện 1 lần per cohort (cả 2 vị trí)
  constraint buddy_pairs_user_a_unique unique (cohort_id, user_a),
  constraint buddy_pairs_user_b_unique unique (cohort_id, user_b),
  constraint buddy_pairs_not_self check (user_a <> user_b)
);

create index idx_buddy_pairs_user_a  on public.buddy_pairs(user_a);
create index idx_buddy_pairs_user_b  on public.buddy_pairs(user_b);
create index idx_buddy_pairs_cohort  on public.buddy_pairs(cohort_id);
create index idx_buddy_pairs_status  on public.buddy_pairs(cohort_id, status);

-- RLS
alter table public.buddy_pairs enable row level security;

create policy "Users can view own buddy pairs"
  on public.buddy_pairs for select
  using (auth.uid() = user_a or auth.uid() = user_b);

create policy "Service role full access on buddy_pairs"
  on public.buddy_pairs for all
  using (auth.role() = 'service_role');
