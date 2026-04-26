-- 045_drop_phone_unique.sql
-- Tạm bỏ unique phone trên profiles để test
-- TODO: bật lại sau khi launch (khi cần enforce 1 số điện thoại = 1 tài khoản)

-- Tên constraint mặc định khi cột được khai báo UNIQUE: <table>_<column>_key
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_phone_key;

-- Một số setup tạo unique qua INDEX thay vì CONSTRAINT — drop luôn để chắc chắn
DROP INDEX IF EXISTS profiles_phone_key;
DROP INDEX IF EXISTS profiles_phone_idx;
DROP INDEX IF EXISTS profiles_phone_unique;

-- Nếu tên constraint khác (ví dụ tự đặt), tìm tên đúng bằng:
-- SELECT constraint_name
-- FROM information_schema.table_constraints
-- WHERE table_name = 'profiles' AND constraint_type = 'UNIQUE';
--
-- Rồi:
-- ALTER TABLE profiles DROP CONSTRAINT IF EXISTS <constraint_name>;
