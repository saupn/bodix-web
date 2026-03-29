-- ============================================================================
-- 035: Affiliate registration fields
-- Add fields for public affiliate registration form + admin review
-- ============================================================================

-- New application fields
ALTER TABLE affiliate_profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS partner_type TEXT
    CHECK (partner_type IN ('pt', 'kol', 'gym_owner', 'blogger', 'other')),
  ADD COLUMN IF NOT EXISTS primary_channel TEXT
    CHECK (primary_channel IN ('zalo', 'facebook', 'instagram', 'tiktok', 'youtube', 'website', 'offline')),
  ADD COLUMN IF NOT EXISTS social_link TEXT,
  ADD COLUMN IF NOT EXISTS estimated_audience TEXT,
  ADD COLUMN IF NOT EXISTS application_note TEXT,
  ADD COLUMN IF NOT EXISTS rejected BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- Allow user_id to be NULL for public registrations (no Supabase account yet)
ALTER TABLE affiliate_profiles
  ALTER COLUMN user_id DROP NOT NULL;

-- Index for admin review queries
CREATE INDEX IF NOT EXISTS idx_affiliate_pending
  ON affiliate_profiles(is_approved, rejected) WHERE is_approved = false AND rejected = false;
