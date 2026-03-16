-- Migration: 031_leads_gift_guide
-- Tặng sách BodiX Fuel Guide — leads + gift suất cho user đã đăng ký

CREATE TABLE IF NOT EXISTS public.leads (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL,
  name text,
  source text DEFAULT 'homepage',
  referral_code text,
  downloaded boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_referral ON public.leads(referral_code);
CREATE INDEX IF NOT EXISTS idx_leads_created ON public.leads(created_at);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gift_total int DEFAULT 10,
  ADD COLUMN IF NOT EXISTS gift_remaining int DEFAULT 10;
