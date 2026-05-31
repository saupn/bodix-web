-- 061_enrollment_commission_context.sql
-- BD-AFFILIATE-REFERRAL-FIXES (Vấn đề 3.E)
--
-- Dual-URL /af/ vs /r/ (Cách 1.5): 1 referral_codes row có thể được dùng qua 2
-- URL khác nhau → tạo commission khác loại (referral voucher vs affiliate cash).
-- code_type trên referral_codes KHÔNG còn quyết định loại commission một mình;
-- context được resolve TỪ URL user đến (cookie code_context) tại lúc checkout.
--
-- Vì SePay webhook chạy server-to-server (KHÔNG có cookie của user), context
-- phải được "đóng băng" lên enrollment tại checkout/create. Conversion sau đó
-- đọc enrollments.commission_program_type để biết tạo commission loại nào.
--
-- NULL = enrollment cũ / không qua /af/ hoặc /r/ → conversion fallback về
-- referral_codes.code_type (giữ nguyên hành vi cũ, không cần backfill).

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS commission_program_type TEXT
    CHECK (commission_program_type IN ('referral', 'affiliate'));

COMMENT ON COLUMN public.enrollments.commission_program_type IS
  'Loại commission được "đóng băng" tại checkout từ context URL (/af/=affiliate, /r/=referral). NULL → conversion fallback referral_codes.code_type.';
