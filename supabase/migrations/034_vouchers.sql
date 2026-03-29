-- ============================================================================
-- 034: Vouchers system
-- Voucher = reward issued to referrer when referee pays. Redeemable at checkout.
-- ============================================================================

-- ── vouchers table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL UNIQUE,
  amount INTEGER NOT NULL,             -- original amount (VND), e.g. 100000
  remaining_amount INTEGER NOT NULL,   -- decreases when partially/fully used
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'used', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  source_type VARCHAR(30) NOT NULL DEFAULT 'referral_reward'
    CHECK (source_type IN ('referral_reward', 'admin_grant', 'promotion')),
  source_referral_tracking_id UUID REFERENCES referral_tracking(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

CREATE INDEX idx_vouchers_user_id ON vouchers(user_id);
CREATE INDEX idx_vouchers_code ON vouchers(code);
CREATE INDEX idx_vouchers_status ON vouchers(status) WHERE status = 'active';

-- RLS
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY vouchers_select_own ON vouchers
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can do everything (via service_role key)

-- ── Add voucher columns to enrollments ──────────────────────────────────────

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS voucher_id UUID REFERENCES vouchers(id),
  ADD COLUMN IF NOT EXISTS voucher_discount_amount INTEGER NOT NULL DEFAULT 0;
