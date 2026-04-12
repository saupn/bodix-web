-- Migration: 039_leads_phone
-- Lead capture qua SĐT (tặng sách); email không còn bắt buộc

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE public.leads ALTER COLUMN email DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);
