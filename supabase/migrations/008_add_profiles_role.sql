-- Migration: 008_add_profiles_role
-- Add role column to profiles for admin access control.

alter table public.profiles
  add column if not exists role text not null default 'user'
    check (role in ('user', 'admin'));

create index if not exists idx_profiles_role on public.profiles(role);

comment on column public.profiles.role is 'user | admin — admin can access /app/admin/*';
