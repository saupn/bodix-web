-- Migration: 018_profiles_role_ensure
-- Ensure role column exists on profiles (idempotent)

alter table public.profiles
  add column if not exists role text default 'user'
  check (role in ('user', 'admin'));

create index if not exists idx_profiles_role on public.profiles(role);
