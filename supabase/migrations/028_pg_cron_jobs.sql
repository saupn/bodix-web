-- Migration: 028_pg_cron_jobs
-- Thiết lập pg_cron jobs gọi cron endpoints trên bodix.fit
--
-- YÊU CẦU: Supabase Pro (pg_cron, pg_net, vault)
-- CHẠY THỦ CÔNG: Sau khi chạy migration, cập nhật secret trong Supabase Dashboard:
--   Vault → cron_secret = giá trị CRON_SECRET từ Vercel env
--
-- LƯU Ý: pg_cron chạy theo UTC. Việt Nam = UTC+7.
-- 6:30 sáng VN = 23:30 UTC ngày hôm trước.
-- 22:00 VN = 15:00 UTC.

-- Bật extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Lưu secret vào Vault (thay YOUR_CRON_SECRET_HERE bằng giá trị thật từ .env CRON_SECRET)
SELECT vault.create_secret('YOUR_CRON_SECRET_HERE', 'cron_secret');

-- Helper function gọi bodix.fit API
CREATE OR REPLACE FUNCTION public.call_bodix_cron(endpoint text)
RETURNS void LANGUAGE sql AS $$
  SELECT net.http_post(
    url := 'https://bodix.fit/api/cron/' || endpoint,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' ||
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
$$;

-- Job 1: Tin nhắc sáng — 6:30 VN = 23:30 UTC ngày trước
-- Endpoint: morning-mesages (tên folder trong app/api/cron/)
SELECT cron.schedule(
  'bodix-morning-messages',
  '30 23 * * *',
  $$ SELECT call_bodix_cron('morning-mesages'); $$
);

-- Job 2: Rescue check — 22:00 VN = 15:00 UTC
SELECT cron.schedule(
  'bodix-rescue-check',
  '0 15 * * *',
  $$ SELECT call_bodix_cron('rescue-check'); $$
);

-- Job 3: Refresh Zalo token — mỗi 20 giờ
SELECT cron.schedule(
  'bodix-refresh-token',
  '0 */20 * * *',
  $$ SELECT call_bodix_cron('refresh-token'); $$
);

-- Job 4: Xóa OTP hết hạn — mỗi giờ
SELECT cron.schedule(
  'bodix-cleanup-otps',
  '0 * * * *',
  $$ DELETE FROM public.otp_verifications WHERE expires_at < now(); $$
);
