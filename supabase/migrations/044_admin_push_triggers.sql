-- Migration: 044_admin_push_triggers
-- DB triggers fan-out push tới admin khi:
--   1) chat_messages INSERT (channel_type='support', sender không phải admin/system)
--   2) orders INSERT
--
-- YÊU CẦU: Supabase Pro (pg_net, vault) — extensions đã bật ở migration 028.
-- DÙNG LẠI vault secret 'cron_secret' (đã tạo ở migration 028).
--
-- Webhook routes:
--   POST https://bodix.fit/api/webhooks/chat-message
--   POST https://bodix.fit/api/webhooks/order-created
--
-- Filter sender ngay trong trigger để giảm số HTTP call (admin/system reply
-- không gọi webhook → không tốn pg_net request).

CREATE OR REPLACE FUNCTION public.notify_admin_chat_message()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.channel_type IS DISTINCT FROM 'support' THEN
    RETURN NEW;
  END IF;
  IF NEW.sender IN ('admin', 'system') THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://bodix.fit/api/webhooks/chat-message',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' ||
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'chat_messages',
      'record', to_jsonb(NEW)
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_chat_message ON public.chat_messages;
CREATE TRIGGER trg_notify_admin_chat_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_chat_message();

CREATE OR REPLACE FUNCTION public.notify_admin_order_created()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://bodix.fit/api/webhooks/order-created',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' ||
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'orders',
      'record', to_jsonb(NEW)
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_order_created ON public.orders;
CREATE TRIGGER trg_notify_admin_order_created
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_order_created();
