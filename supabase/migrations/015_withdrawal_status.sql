-- Migration: 015_withdrawal_status
-- Add status for withdrawal transactions in user_credits

alter table public.user_credits
  add column if not exists withdrawal_status text
  check (withdrawal_status is null or withdrawal_status in ('pending', 'paid', 'rejected'));

comment on column public.user_credits.withdrawal_status is 'For transaction_type=withdrawal: pending|paid|rejected';

create index if not exists idx_user_credits_withdrawal_status
  on public.user_credits(transaction_type, withdrawal_status)
  where transaction_type = 'withdrawal';
