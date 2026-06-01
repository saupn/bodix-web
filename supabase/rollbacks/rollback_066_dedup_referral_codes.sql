-- DO NOT RUN AUTOMATICALLY.
-- rollback_066_dedup_referral_codes.sql
-- Khôi phục referral_codes + profiles.referral_code về trạng thái trước migration 066,
-- và gỡ UNIQUE constraint uq_referral_codes_user_id.
--
-- Phục hồi từ backup table referral_codes_backup_20260601 +
-- profiles_refcode_backup_20260601 (tạo bởi migration 066).
--
-- KHÔNG dùng TRUNCATE (referral_codes có inbound FK). Dùng INSERT lại các row đã
-- xóa + UPDATE các cột đã đổi từ backup.

BEGIN;

-- ── Safety: backup tables phải tồn tại ───────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.referral_codes_backup_20260601') IS NULL THEN
    RAISE EXCEPTION 'Missing backup table referral_codes_backup_20260601 — abort rollback';
  END IF;
  IF to_regclass('public.profiles_refcode_backup_20260601') IS NULL THEN
    RAISE EXCEPTION 'Missing backup table profiles_refcode_backup_20260601 — abort rollback';
  END IF;
END $$;

-- ── Gỡ UNIQUE constraint trước (để có thể khôi phục >1 dòng/user) ────────────
ALTER TABLE referral_codes DROP CONSTRAINT IF EXISTS uq_referral_codes_user_id;

-- ── Khôi phục các dòng mã đã bị xóa (3 dòng) từ backup ───────────────────────
INSERT INTO referral_codes
SELECT * FROM referral_codes_backup_20260601 b
WHERE b.id IN (
  '4bd10884-7966-4aa1-82f6-e43c4e361bc3',  -- PHAMNGOCSAU
  '7678c3b8-4185-48e3-8232-1884630604dc',  -- TRANPHUONGLINH
  '0cd45cc5-c081-4dd9-94c3-d2ff6a589126'   -- TRUONGTIEN2
)
ON CONFLICT (id) DO NOTHING;

-- ── Khôi phục is_affiliate (migration set true; backup giữ giá trị cũ) ───────
UPDATE referral_codes rc
SET is_affiliate = b.is_affiliate
FROM referral_codes_backup_20260601 b
WHERE rc.id = b.id;

-- ── Khôi phục profiles.referral_code từ backup ───────────────────────────────
UPDATE profiles p
SET referral_code = b.referral_code
FROM profiles_refcode_backup_20260601 b
WHERE p.id = b.id;

-- ── Verify: số dòng referral_codes khớp backup ───────────────────────────────
DO $$
DECLARE now_count INT; backup_count INT;
BEGIN
  SELECT count(*) INTO now_count FROM referral_codes;
  SELECT count(*) INTO backup_count FROM referral_codes_backup_20260601;
  IF now_count <> backup_count THEN
    RAISE EXCEPTION 'Rollback mismatch: referral_codes có % dòng, backup có %', now_count, backup_count;
  END IF;
END $$;

COMMIT;
