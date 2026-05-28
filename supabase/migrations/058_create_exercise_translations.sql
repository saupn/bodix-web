-- Migration 058: Tạo bảng exercise_translations để dịch tên động tác EN → VI
-- ============================================================================
-- Lý do: tin nhắn morning Zalo đang dùng tên động tác tiếng Anh. Target user
-- (nữ 25-42 VN) phần lớn không quen term fitness tiếng Anh, cần hiển thị
-- "Tiếng Việt (English)" – ví dụ "Chống đẩy (Push-up)".
--
-- Quyết định: lookup table thay vì modify JSONB hard_version/light_version.
-- Term không có tên Việt phổ biến (Burpee, Plank, Squat, Tricep Dip) giữ
-- nguyên English bằng cách set name_vi = NULL → helper sẽ chỉ hiển thị EN.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.exercise_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en TEXT NOT NULL UNIQUE,
  name_vi TEXT,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive lookup index (helper key = LOWER(name_en))
CREATE INDEX IF NOT EXISTS idx_exercise_translations_name_en_lower
  ON public.exercise_translations (LOWER(name_en));

-- Backfill 29 động tác (Burpee/Plank/Squat/Tricep Dip giữ NULL → English-only)
INSERT INTO public.exercise_translations (name_en, name_vi, category) VALUES
  ('Arm Circle',           'Xoay cánh tay',                  'warmup'),
  ('Bicycle Crunch',       'Gập bụng đạp xe',                'core'),
  ('Bird Dog',             'Tư thế chim – chó',              'core'),
  ('Burpee',                NULL,                            'cardio'),
  ('Calf Raise',           'Kiễng chân',                     'lower_body'),
  ('Cat-Cow Stretch',      'Giãn cơ tư thế mèo – bò',        'stretching'),
  ('Child Pose',           'Tư thế em bé',                   'stretching'),
  ('Crunch',               'Gập bụng',                       'core'),
  ('Glute Bridge',         'Cầu mông',                       'lower_body'),
  ('High Knees',           'Chạy nâng cao gối',              'cardio'),
  ('Hip Flexor Stretch',   'Giãn cơ gấp hông',               'stretching'),
  ('Jump Squat',           'Squat bật nhảy',                 'lower_body'),
  ('Jumping Jack',         'Nhảy dang tay chân',             'cardio'),
  ('Lunge',                'Chùng chân',                     'lower_body'),
  ('Lunge to Twist',       'Chùng chân kết hợp xoay người',  'full_body'),
  ('Mountain Climber',     'Leo núi',                        'cardio'),
  ('Plank',                 NULL,                            'core'),
  ('Plank Hold',           'Giữ tư thế plank',               'core'),
  ('Plank to Push-up',     'Plank chuyển chống đẩy',         'full_body'),
  ('Push-up',              'Chống đẩy',                      'upper_body'),
  ('Savasana',             'Tư thế thư giãn nằm ngửa',       'stretching'),
  ('Seated Forward Fold',  'Gập người về trước khi ngồi',    'stretching'),
  ('Shoulder Press',       'Đẩy vai',                        'upper_body'),
  ('Side Plank',           'Plank nghiêng',                  'core'),
  ('Squat',                 NULL,                            'lower_body'),
  ('Squat Jump',           'Squat bật nhảy',                 'lower_body'),
  ('Squat to Press',       'Squat kết hợp đẩy tay',          'full_body'),
  ('Tricep Dip',            NULL,                            'upper_body'),
  ('Wall Sit',             'Ngồi dựa tường',                 'lower_body')
ON CONFLICT (name_en) DO NOTHING;

-- RLS: bảng read-only cho tất cả (kể cả anon) — không có dữ liệu nhạy cảm
ALTER TABLE public.exercise_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exercise_translations_select_all"
  ON public.exercise_translations;
CREATE POLICY "exercise_translations_select_all"
  ON public.exercise_translations
  FOR SELECT
  TO public
  USING (true);

-- Verify
DO $$
DECLARE
  total_count INT;
  null_count INT;
BEGIN
  SELECT COUNT(*) INTO total_count FROM public.exercise_translations;
  IF total_count < 29 THEN
    RAISE EXCEPTION 'migration 058 verify failed: expected ≥29 rows, got %', total_count;
  END IF;

  SELECT COUNT(*) INTO null_count
  FROM public.exercise_translations
  WHERE name_vi IS NULL;
  IF null_count < 4 THEN
    RAISE EXCEPTION 'migration 058 verify failed: expected ≥4 English-only rows (Burpee/Plank/Squat/Tricep Dip), got %', null_count;
  END IF;
END $$;

COMMIT;
