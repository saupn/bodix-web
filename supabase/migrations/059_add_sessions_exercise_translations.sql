-- Migration 059: Bổ sung 15 tên động tác đang dùng trong SESSIONS constant
-- ============================================================================
-- Migration 058 đã seed 29 tên lấy từ workout_templates. Nhưng tin nhắn morning
-- render từ SESSIONS constant trong app/api/cron/morning-messages/route.ts —
-- chứa các tên KHÁC chưa có trong bảng.
--
-- Quyết định: MỞ RỘNG bảng (không rename SESSIONS) → idempotent insert với
-- ON CONFLICT DO NOTHING để an toàn re-run.
--
-- Lưu ý:
-- * 'Tricep Dip' đã có trong 058 với name_vi = NULL (giữ English) — KHÔNG đụng
-- * 'Cat-Cow' (SESSIONS) khác 'Cat-Cow Stretch' (workout_templates) → cả 2
--   cùng tồn tại với bản dịch riêng
-- * 'Light Burpee' là dạng canonical English; SESSIONS hiện dùng "Burpee nhẹ"
--   nên hiện tại sẽ fallback English (= "Burpee nhẹ", đã là tiếng Việt sẵn).
--   Entry này phục vụ canonicalization tương lai.
-- ============================================================================

BEGIN;

INSERT INTO public.exercise_translations (name_en, name_vi, category) VALUES
  ('Light Burpee',       'Burpee nhẹ',                     'cardio'),
  ('Cat-Cow',            'Tư thế mèo – bò',                'stretching'),
  ('Child''s Pose',      'Tư thế em bé',                   'stretching'),
  ('Dead Bug',           'Tư thế bọ chết',                 'core'),
  ('Hamstring Stretch',  'Giãn cơ đùi sau',                'stretching'),
  ('Hip Opener',         'Mở khớp hông',                   'stretching'),
  ('Inchworm',           'Tư thế con sâu đo',              'full_body'),
  ('Knee Lift',          'Nâng gối',                       'cardio'),
  ('Low Jack',           'Nhảy dang chân nhẹ',             'cardio'),
  ('Lunge Twist',        'Chùng chân kết hợp xoay người',  'full_body'),
  ('March in Place',     'Giậm chân tại chỗ',              'cardio'),
  ('Plank Shoulder Tap', 'Plank chạm vai',                 'core'),
  ('Shoulder Stretch',   'Giãn cơ vai',                    'stretching'),
  ('Side Step',          'Bước sang ngang',                'cardio'),
  ('Step Touch',         'Bước chạm chân',                 'cardio')
ON CONFLICT (name_en) DO NOTHING;

-- Verify
DO $$
DECLARE
  total_count INT;
  null_count INT;
BEGIN
  SELECT COUNT(*) INTO total_count FROM public.exercise_translations;
  IF total_count < 44 THEN
    RAISE EXCEPTION 'migration 059 verify failed: expected ≥44 rows (29+15), got %', total_count;
  END IF;

  -- Phải giữ đúng 4 row English-only: Burpee, Plank, Squat, Tricep Dip
  SELECT COUNT(*) INTO null_count
  FROM public.exercise_translations
  WHERE name_vi IS NULL;
  IF null_count <> 4 THEN
    RAISE EXCEPTION 'migration 059 verify failed: expected exactly 4 English-only rows, got %', null_count;
  END IF;
END $$;

COMMIT;
