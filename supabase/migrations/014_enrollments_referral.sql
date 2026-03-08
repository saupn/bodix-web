-- Migration: 014_enrollments_referral
-- Requires: 013_referral_affiliate

alter table public.enrollments
  add column if not exists referral_code_id uuid references public.referral_codes(id),
  add column if not exists referral_discount_amount integer not null default 0;

comment on column public.enrollments.referral_code_id is
  'Referral code used at checkout — drives post-payment reward flow.';
comment on column public.enrollments.referral_discount_amount is
  'Discount applied in VND from referral code (0 if no code used).';

create index if not exists idx_enrollments_referral_code
  on public.enrollments(referral_code_id)
  where referral_code_id is not null;
