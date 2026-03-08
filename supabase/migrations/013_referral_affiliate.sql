-- Migration: 013_referral_affiliate
-- Requires: 001_create_profiles, 003_create_program_engine

-- ============================================
-- 1. REFERRAL CODES
-- ============================================
create table public.referral_codes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  code text unique not null,              -- VD: 'MINH2026', 'BODIX-A7K3'
  code_type text not null check (code_type in ('referral', 'affiliate')),

  -- Referral rewards config
  reward_type text default 'credit' check (reward_type in ('credit', 'discount_percent', 'discount_fixed', 'free_days')),
  reward_value integer default 0,         -- giá trị reward (VND hoặc %, hoặc số ngày)
  referee_reward_type text default 'discount_percent',  -- người được giới thiệu nhận gì
  referee_reward_value integer default 10,              -- VD: giảm 10%

  -- Affiliate config (chỉ cho code_type = 'affiliate')
  commission_rate numeric(5,2) default 0, -- % commission, VD: 15.00
  commission_type text default 'percentage' check (commission_type in ('percentage', 'fixed')),

  -- Tracking
  total_clicks integer default 0,
  total_signups integer default 0,        -- số người đăng ký qua code
  total_conversions integer default 0,    -- số người mua qua code
  total_revenue_generated integer default 0,  -- tổng doanh thu VND

  -- Status
  is_active boolean default true,
  max_uses integer,                       -- null = unlimited
  expires_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 2. REFERRAL TRACKING (mỗi lượt giới thiệu)
-- ============================================
create table public.referral_tracking (
  id uuid default gen_random_uuid() primary key,
  referral_code_id uuid references public.referral_codes(id) not null,
  referrer_id uuid references public.profiles(id) not null,     -- người giới thiệu
  referred_id uuid references public.profiles(id),              -- người được giới thiệu (null nếu chưa signup)

  -- Tracking journey
  status text default 'clicked' check (status in (
    'clicked',           -- click link giới thiệu
    'signed_up',         -- đăng ký tài khoản
    'trial_started',     -- bắt đầu trial
    'converted',         -- mua chương trình
    'completed',         -- hoàn thành chương trình (bonus tier)
    'expired',           -- không convert trong thời hạn
    'fraudulent'         -- phát hiện gian lận
  )),

  -- Conversion data
  program_id uuid references public.programs(id),
  enrollment_id uuid references public.enrollments(id),
  conversion_amount integer,              -- VND đã thanh toán

  -- Anti-fraud
  referral_ip text,
  referral_device text,
  referral_source text,                   -- 'zalo_share', 'facebook_share', 'copy_link', 'qr_code'

  -- Timestamps
  clicked_at timestamptz default now(),
  signed_up_at timestamptz,
  converted_at timestamptz,

  created_at timestamptz default now()
);

-- ============================================
-- 3. REFERRAL REWARDS (phần thưởng cho referrer)
-- ============================================
create table public.referral_rewards (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,        -- người nhận reward
  referral_tracking_id uuid references public.referral_tracking(id),

  reward_type text not null check (reward_type in ('credit', 'discount_percent', 'discount_fixed', 'free_days', 'commission')),
  reward_value integer not null,          -- giá trị
  reward_description text,                -- "Giới thiệu Lan T. → 50.000đ credit"

  status text default 'pending' check (status in ('pending', 'approved', 'paid', 'rejected')),
  approved_at timestamptz,
  paid_at timestamptz,

  created_at timestamptz default now()
);

-- ============================================
-- 4. USER CREDITS (ví credit cho referral rewards)
-- ============================================
create table public.user_credits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  amount integer not null,                -- VND (dương = cộng, âm = trừ)
  balance_after integer not null,         -- số dư sau giao dịch
  transaction_type text not null check (transaction_type in (
    'referral_reward',      -- nhận từ giới thiệu
    'affiliate_commission', -- nhận commission
    'purchase_discount',    -- dùng credit mua chương trình
    'withdrawal',           -- rút tiền (affiliate)
    'admin_adjustment'      -- admin điều chỉnh
  )),
  reference_id uuid,                      -- ID bản ghi liên quan
  description text,
  created_at timestamptz default now()
);

-- ============================================
-- 5. AFFILIATE PROFILES (thông tin bổ sung cho affiliates)
-- ============================================
create table public.affiliate_profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null unique,

  -- Thông tin affiliate
  affiliate_tier text default 'basic' check (affiliate_tier in ('basic', 'silver', 'gold', 'platinum')),
  social_channels jsonb default '[]',     -- [{ platform: 'instagram', url: '...', followers: 5000 }]

  -- Thanh toán
  bank_name text,
  bank_account_number text,
  bank_account_name text,

  -- Stats
  total_earned integer default 0,         -- tổng VND đã kiếm
  total_paid integer default 0,           -- tổng VND đã thanh toán
  pending_balance integer default 0,      -- VND chờ thanh toán

  -- Status
  is_approved boolean default false,
  approved_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- RLS POLICIES
-- ============================================
alter table public.referral_codes enable row level security;
alter table public.referral_tracking enable row level security;
alter table public.referral_rewards enable row level security;
alter table public.user_credits enable row level security;
alter table public.affiliate_profiles enable row level security;

-- Referral codes: user quản lý code của mình
create policy "Users manage own referral codes" on public.referral_codes
  for all using (auth.uid() = user_id);

-- Tracking: user thấy referrals do mình giới thiệu
create policy "Users view own referral tracking" on public.referral_tracking
  for select using (auth.uid() = referrer_id);

-- Rewards: user thấy rewards của mình
create policy "Users view own rewards" on public.referral_rewards
  for select using (auth.uid() = user_id);

-- Credits: user thấy giao dịch credit của mình
create policy "Users view own credits" on public.user_credits
  for select using (auth.uid() = user_id);

-- Affiliate: user quản lý affiliate profile của mình
create policy "Users manage own affiliate" on public.affiliate_profiles
  for all using (auth.uid() = user_id);

-- ============================================
-- INDEXES
-- ============================================
create index idx_referral_codes_user on public.referral_codes(user_id);
create index idx_referral_codes_code on public.referral_codes(code);
create index idx_referral_tracking_code on public.referral_tracking(referral_code_id);
create index idx_referral_tracking_referrer on public.referral_tracking(referrer_id);
create index idx_referral_tracking_referred on public.referral_tracking(referred_id);
create index idx_rewards_user on public.referral_rewards(user_id);
create index idx_credits_user on public.user_credits(user_id);

-- ============================================
-- FUNCTION: Tính credit balance
-- ============================================
create or replace function public.get_credit_balance(p_user_id uuid)
returns integer as $$
  select coalesce(sum(amount), 0)::integer
  from public.user_credits
  where user_id = p_user_id;
$$ language sql security definer;
