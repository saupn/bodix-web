-- verify_062_genome_v1.sql
-- Chạy SAU khi `supabase db push` migration 062. Mỗi mục in PASS/FAIL.
-- An toàn chạy nhiều lần (snapshot idempotent nhờ on conflict).

-- 1. Bảng tồn tại
select case when to_regclass('public.enrollment_daily') is not null
  then 'PASS: enrollment_daily tồn tại' else 'FAIL: thiếu enrollment_daily' end;

-- 2. RLS bật
select case when relrowsecurity then 'PASS: RLS bật' else 'FAIL: RLS tắt' end
from pg_class where relname = 'enrollment_daily';

-- 3. Ba hàm tồn tại
select 'Hàm: ' || string_agg(proname, ', ')
from pg_proc
where proname in ('bodix_snapshot_enrollment_daily','bodix_emit_dropout_signals','bodix_run_genome_daily');
-- Kỳ vọng đủ 3 tên.

-- 4. Cron job đã lên lịch, đúng giờ, KHÔNG gọi http
select case
  when count(*) = 1 and bool_and(command not ilike '%http%')
    then 'PASS: genome-daily 1 job, không gọi http'
  else 'FAIL: kiểm lại job genome-daily' end
from cron.job where jobname = 'genome-daily';

select jobname, schedule, command from cron.job where jobname = 'genome-daily';

-- 5. Genome là writer DUY NHẤT của dropout_signals: KHÔNG có pg_cron nào khác
--    gọi dropout-scanner (net.http) và KHÔNG có Vercel cron trùng. Kiểm thủ công:
select jobname, schedule, command from cron.job order by jobid;
-- Kỳ vọng: chỉ bodix-refresh-token, bodix-cleanup-otps, genome-daily. KHÔNG có job
-- nào trỏ tới /api/cron/dropout-scanner hay function dropout-scanner.

-- 6. Chạy thử genome hôm nay (an toàn, idempotent)
select public.bodix_run_genome_daily();

-- 7. Xem kết quả ngày hôm nay
select count(*) as rows_today,
       count(*) filter (where checked_in) as checked_in,
       count(*) filter (where risk_band = 'high') as high_risk
from public.enrollment_daily
where snapshot_date = (now() at time zone 'Asia/Ho_Chi_Minh')::date;

-- 8. IDEMPOTENT: chạy lần 2 KHÔNG nhân đôi dòng (enrollment_id, snapshot_date) unique
select public.bodix_run_genome_daily();
select case when count(*) = 0 then 'PASS: không trùng dòng sau 2 lần chạy'
  else 'FAIL: có dòng trùng' end
from (
  select enrollment_id, snapshot_date, count(*) c
  from public.enrollment_daily group by 1,2 having count(*) > 1
) t;

-- 9. IDEMPOTENT: dropout_signals không nhân đôi trong cùng ngày (not exists guard)
select case when count(*) = 0 then 'PASS: dropout_signals không trùng loại trong ngày'
  else 'FAIL: dropout_signals trùng' end
from (
  select enrollment_id, signal_date, signal_type, count(*) c
  from public.dropout_signals
  where signal_date = (now() at time zone 'Asia/Ho_Chi_Minh')::date
  group by 1,2,3 having count(*) > 1
) t;
