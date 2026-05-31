-- rollback_058_genome_v1.sql
-- Hoàn tác migration 058. Lưu ý: dropout_signals KHÔNG bị xoá (bảng có sẵn từ trước),
-- chỉ xoá các dòng do genome ghi vào trong khoảng test nếu muốn (mục cuối, tùy chọn).

-- 1. Gỡ lịch cron
select cron.unschedule('genome-daily')
where exists (select 1 from cron.job where jobname = 'genome-daily');

-- 2. Xoá các hàm
drop function if exists public.bodix_run_genome_daily(date);
drop function if exists public.bodix_emit_dropout_signals(date);
drop function if exists public.bodix_snapshot_enrollment_daily(date);

-- 3. Xoá bảng snapshot (kéo theo index + policy)
drop table if exists public.enrollment_daily;

-- 4. (TÙY CHỌN) gỡ tín hiệu genome đã ghi trong dropout_signals khi test.
-- Bỏ comment nếu cần làm sạch. Cẩn thận nếu đã có dữ liệu thật.
-- delete from public.dropout_signals
-- where details ? 'program_day';
