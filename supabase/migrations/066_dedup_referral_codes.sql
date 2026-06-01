-- 066_dedup_referral_codes.sql
-- Gộp nhiều mã giới thiệu/affiliate của 1 user về DUY NHẤT 1 mã chung.
--
-- ROOT CAUSE (3 mã khác nhau cho cùng 1 user):
--   - Mỗi user có 2 dòng referral_codes: 1 code_type='referral' + 1 'affiliate'
--     → 2 mã khác nhau.
--   - profiles.referral_code là nguồn thứ 3, lại khác nữa.
--   - 3 trang (referral / affiliate / tặng sách) đọc 3 nguồn → hiển thị 3 mã.
--
-- Kiến trúc dual-URL đã chốt: 1 MÃ CHUNG cho mỗi user; loại (referral vs affiliate)
-- do URL (/r/ vs /af/) + enrollments.commission_program_type quyết định, KHÔNG do
-- code_type của dòng mã. is_affiliate=true đánh dấu quyền affiliate trên dòng đó.
--
-- DATA: Founder xác nhận toàn bộ là test data, được phép xóa mã thừa.
-- Đã verify trước: 3 mã bị xóa có 0 inbound FK (enrollments + referral_tracking).
--
-- Quy tắc giữ mã: (1) có conversion → giữ; (2) không → giữ mã NGẮN HƠN.
--   25fe4cd5 (Ngọc Sáu)   : GIỮ NGOCSAU      , XÓA PHAMNGOCSAU
--   41e706f5 (Phương Linh): GIỮ PHUONGLINH   , XÓA TRANPHUONGLINH
--   ebed8994 (Trương Tiên): GIỮ TRUONGTIEN   , XÓA TRUONGTIEN2
--   c4c71619 (Phạm Sáu 2) : GIỮ PHAMSAU      (chỉ 1 dòng — không đụng)

BEGIN;

-- ── Backup (giữ ≥ 30 ngày) ───────────────────────────────────────────────────
CREATE TABLE referral_codes_backup_20260601 AS
  SELECT * FROM referral_codes;

-- Backup cột profiles.referral_code (migration này UPDATE nó → cần để rollback).
CREATE TABLE profiles_refcode_backup_20260601 AS
  SELECT id, referral_code FROM profiles;

-- ── Safety: chặn xóa nếu mã bị FK reference (enrollments / referral_tracking) ──
-- (Các mã xóa đều 0 ref tại thời điểm soạn migration; check lại để an toàn.)
DO $$
DECLARE ref_count INT;
BEGIN
  SELECT count(*) INTO ref_count
  FROM (
    SELECT id FROM referral_codes
    WHERE id IN (
      '4bd10884-7966-4aa1-82f6-e43c4e361bc3',  -- PHAMNGOCSAU
      '7678c3b8-4185-48e3-8232-1884630604dc',  -- TRANPHUONGLINH
      '0cd45cc5-c081-4dd9-94c3-d2ff6a589126'   -- TRUONGTIEN2
    )
  ) d
  WHERE EXISTS (SELECT 1 FROM enrollments e WHERE e.referral_code_id = d.id)
     OR EXISTS (SELECT 1 FROM referral_tracking t WHERE t.referral_code_id = d.id);

  IF ref_count > 0 THEN
    RAISE EXCEPTION 'Abort: % mã định xóa vẫn còn FK reference — cần chuyển reference trước', ref_count;
  END IF;
END $$;

-- ── Xóa mã thừa (chỉ mã 0 conversion, 0 FK) ──────────────────────────────────
DELETE FROM referral_codes
WHERE id IN (
  '4bd10884-7966-4aa1-82f6-e43c4e361bc3',  -- PHAMNGOCSAU
  '7678c3b8-4185-48e3-8232-1884630604dc',  -- TRANPHUONGLINH
  '0cd45cc5-c081-4dd9-94c3-d2ff6a589126'   -- TRUONGTIEN2
);

-- ── Đánh dấu quyền affiliate trên mã được giữ (3 user là affiliate) ──────────
-- KHÔNG đổi code_type (giữ semantics commission fallback); chỉ set is_affiliate.
UPDATE referral_codes SET is_affiliate = true
WHERE user_id IN (
  '25fe4cd5-8635-4aa9-8e6c-a788985e93c8',
  '41e706f5-297c-4829-94c9-ca7a2d91ad25',
  'ebed8994-7487-4322-a6cd-c2ff489c59dd'
);

-- ── Sync profiles.referral_code = mã được giữ (single source of truth) ───────
UPDATE profiles p SET referral_code = rc.code
FROM referral_codes rc WHERE rc.user_id = p.id;

-- ── Verify: mỗi user chỉ còn 1 mã ────────────────────────────────────────────
DO $$
DECLARE dup_count INT;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT user_id FROM referral_codes GROUP BY user_id HAVING COUNT(*) > 1
  ) t;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Still have % users with duplicate codes', dup_count;
  END IF;
END $$;

-- ── 3.D: UNIQUE constraint chặn tái diễn (1 mã / user vĩnh viễn) ─────────────
ALTER TABLE referral_codes
  ADD CONSTRAINT uq_referral_codes_user_id UNIQUE (user_id);

COMMIT;
