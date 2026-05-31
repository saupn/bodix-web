-- genome_analysis_queries.sql
-- Thư viện truy vấn phân tích genome. Chạy KHI đã có cohort thật chạy đủ ngày.
-- Đây là phần "đọc" genome; migration 058 là phần "ghi".
-- Tất cả đều đọc từ enrollment_daily.

-- ============================================================
-- 1. ĐƯỜNG CONG SỐNG SÓT (tìm "ngày vách đá")
-- Bao nhiêu % còn active ở mỗi program_day. Rơi mạnh nhất ở đâu = điểm gãy.
-- ============================================================
with by_day as (
  select program_day,
         count(*)                                   as total,
         count(*) filter (where checked_in)         as did_checkin
  from public.enrollment_daily
  where program_day is not null
  group by program_day
)
select program_day,
       did_checkin,
       total,
       round(100.0 * did_checkin / nullif(total,0), 1) as checkin_pct
from by_day
order by program_day;

-- ============================================================
-- 2. DROPOUT CLIFF: chênh lệch check-in giữa ngày liền kề
-- Số âm lớn = vách đá. Kỳ vọng thấy quanh D3, D7, D14 theo kế hoạch.
-- ============================================================
with daily as (
  select program_day,
         round(100.0 * count(*) filter (where checked_in) / nullif(count(*),0), 1) as pct
  from public.enrollment_daily
  where program_day is not null
  group by program_day
)
select program_day, pct,
       pct - lag(pct) over (order by program_day) as delta_vs_prev_day
from daily order by program_day;

-- ============================================================
-- 3. COMPLETION RATE THEO COHORT (không nhìn trung bình chung)
-- KPI Năm 1: BodiX 21 >= 55%.
-- ============================================================
select c.id as cohort_id, c.name, p.slug,
       count(distinct e.id)                                              as enrolled,
       count(distinct e.id) filter (where e.status = 'completed')        as completed,
       round(100.0 * count(distinct e.id) filter (where e.status='completed')
             / nullif(count(distinct e.id),0), 1)                        as completion_pct
from public.cohorts c
join public.programs p on p.id = c.program_id
left join public.enrollments e on e.cohort_id = c.id
group by c.id, c.name, p.slug
order by c.start_date desc;

-- ============================================================
-- 4. PHÂN BỐ RISK theo ngày (sức khỏe cohort đang chạy)
-- ============================================================
select snapshot_date,
       count(*) filter (where risk_band = 'high')   as high,
       count(*) filter (where risk_band = 'medium') as medium,
       count(*) filter (where risk_band = 'low')    as low
from public.enrollment_daily
group by snapshot_date order by snapshot_date desc limit 30;

-- ============================================================
-- 5. RISK Ở D7/D14 CÓ DỰ BÁO DROP THẬT KHÔNG (kiểm chất lượng luật)
-- So người high-risk ở D7 với việc họ có completed hay không.
-- Dùng để hiệu chỉnh trọng số risk_score sau vài cohort.
-- ============================================================
with risk_d7 as (
  select distinct enrollment_id, user_id
  from public.enrollment_daily
  where program_day = 7 and risk_band = 'high'
)
select count(*) as flagged_high_d7,
       count(*) filter (where e.status = 'dropped')   as later_dropped,
       count(*) filter (where e.status = 'completed') as later_completed
from risk_d7 r
join public.enrollments e on e.id = r.enrollment_id;

-- ============================================================
-- 6. CHECK-IN MUỘN DẦN (chỉ báo sớm: giờ check-in trôi về khuya rồi tắt)
-- ============================================================
select user_id, program_day, completed_hour_vn, mode, feeling, risk_band
from public.enrollment_daily
where completed_hour_vn is not null
order by user_id, program_day;
