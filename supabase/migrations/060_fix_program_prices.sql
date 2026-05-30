-- Fix giá BodiX 6W và 12W trong DB (đã thống nhất ở task BD-PRICE-FIX-AND-MORNING-PAID-TRIAL).
--   bodix-6w:  1.990.000đ → 1.199.000đ
--   bodix-12w: 3.490.000đ → 1.999.000đ
--   bodix-21:  499.000đ (giữ nguyên)
--
-- Code đã hiển thị giá mới (lib/config/pricing.ts, components/sections/Pricing.tsx, …);
-- DB đang lệch. Migration đồng bộ DB về giá đúng.

BEGIN;

-- Backup giá hiện tại (giữ ≥ 30 ngày, drop tay sau khi confirm ổn định)
CREATE TABLE IF NOT EXISTS public.programs_price_backup_20260530 AS
SELECT id, slug, name, price_vnd, NOW() AS backed_up_at
FROM public.programs;

-- Update giá đúng
UPDATE public.programs SET price_vnd = 1199000 WHERE slug = 'bodix-6w';
UPDATE public.programs SET price_vnd = 1999000 WHERE slug = 'bodix-12w';

-- Verify
DO $$
DECLARE
  price_6w  INT;
  price_12w INT;
  price_21  INT;
BEGIN
  SELECT price_vnd INTO price_6w  FROM public.programs WHERE slug = 'bodix-6w';
  SELECT price_vnd INTO price_12w FROM public.programs WHERE slug = 'bodix-12w';
  SELECT price_vnd INTO price_21  FROM public.programs WHERE slug = 'bodix-21';

  IF price_6w IS NULL THEN
    RAISE EXCEPTION 'migration 060: program bodix-6w không tồn tại';
  END IF;
  IF price_12w IS NULL THEN
    RAISE EXCEPTION 'migration 060: program bodix-12w không tồn tại';
  END IF;
  IF price_21 IS NULL THEN
    RAISE EXCEPTION 'migration 060: program bodix-21 không tồn tại';
  END IF;

  IF price_6w <> 1199000 THEN
    RAISE EXCEPTION 'migration 060: bodix-6w price sai sau update: %', price_6w;
  END IF;
  IF price_12w <> 1999000 THEN
    RAISE EXCEPTION 'migration 060: bodix-12w price sai sau update: %', price_12w;
  END IF;
  IF price_21 <> 499000 THEN
    RAISE EXCEPTION 'migration 060: bodix-21 price thay đổi ngoài dự kiến: %', price_21;
  END IF;
END $$;

COMMIT;
