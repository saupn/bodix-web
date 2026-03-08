-- Add onboarding_completed column to profiles
-- Required by auth/callback, user status logic, and complete-onboarding API

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;
