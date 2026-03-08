-- Migration: 002_create_phone_otps
-- Creates the phone_otps table for OTP-based phone verification.

create table if not exists public.phone_otps (
  id          uuid primary key default gen_random_uuid(),
  phone       text        not null,
  otp_code    text        not null,
  expires_at  timestamptz not null,
  verified    boolean     not null default false,
  created_at  timestamptz not null default now()
);

-- Index for rate-limit queries (phone + created_at)
create index if not exists phone_otps_phone_created_at_idx
  on public.phone_otps (phone, created_at desc);

-- RLS: enable row-level security
alter table public.phone_otps enable row level security;

-- No policies → only service_role (which bypasses RLS) can read/write.
-- Authenticated users and anonymous callers cannot access this table directly.

-- ---------------------------------------------------------------------------
-- Cleanup: delete expired OTPs automatically.
--
-- Option A (recommended): pg_cron extension (available on Supabase Pro).
--   Run via Supabase Dashboard → Database → Extensions → enable pg_cron, then:
--
--   select cron.schedule(
--     'delete-expired-otps',
--     '*/10 * * * *',   -- every 10 minutes
--     $$ delete from public.phone_otps where expires_at < now() $$
--   );
--
-- Option B: call this function from your application on each send-otp request.
-- ---------------------------------------------------------------------------
create or replace function public.cleanup_expired_otps()
returns void
language sql
security definer
as $$
  delete from public.phone_otps where expires_at < now();
$$;
