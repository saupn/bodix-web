-- Migration 069: Bổ sung 23 bản dịch còn thiếu vào exercise_translations
-- ============================================================================
-- Lý do: sau khi migration 068 seed tên bài THẬT vào workout_templates.exercises
-- (Squats, Reverse Lunge, Good Morning Prisoner...), bảng exercise_translations
-- (seed ở 058/059 theo bộ tên cũ + SESSIONS hardcode) thiếu 23 tên đang dùng →
-- tin nhắn morning và trang phiên tập không dịch được, hiển thị tiếng Anh trần.
--
-- Source of truth tên bài: workout_templates.exercises.items[].name. Migration
-- này phủ kín 100% tên đó để helper translate luôn có bản dịch.
--
-- Idempotent: ON CONFLICT (name_en) DO NOTHING — re-run an toàn. Đây là INSERT
-- thuần (không UPDATE/DELETE dữ liệu cũ) nên KHÔNG cần backup table.
-- Matching ở app dùng LOWER(name_en) → trùng tên khác hoa/thường vẫn dịch được.
-- ============================================================================

BEGIN;

INSERT INTO public.exercise_translations (name_en, name_vi, category) VALUES
  ('Arm Circles',                     'Xoay cánh tay',                          'warmup'),
  ('Child Pose into Cobra Flow',      'Tư thế em bé chuyển rắn hổ mang',        'stretching'),
  ('Extended Crunch',                 'Gập bụng mở rộng',                       'core'),
  ('Good Morning Prisoner',           'Gập người chào buổi sáng',               'lower_body'),
  ('High Knee March',                 'Giậm chân nâng cao gối',                 'cardio'),
  ('Knee Push Up',                    'Chống đẩy quỳ gối',                      'upper_body'),
  ('Knee Push Up Rotations',          'Chống đẩy quỳ gối kết hợp xoay',         'upper_body'),
  ('Reverse Lunge',                   'Chùng chân ra sau',                      'lower_body'),
  ('Reverse Lunge Knee Lift',         'Chùng chân ra sau nâng gối',             'lower_body'),
  ('Reverse Woodchop',                'Bổ củi ngược',                           'core'),
  ('Romanian Deadlift',               'Nâng tạ kiểu Romania',                   'lower_body'),
  ('Run In Place',                    'Chạy tại chỗ',                           'cardio'),
  ('Seated Lateral Overhead Stretch', 'Giãn cơ nghiêng người khi ngồi',         'stretching'),
  ('Side Lunge',                      'Chùng chân sang ngang',                  'lower_body'),
  ('Skater Jump',                     'Nhảy kiểu trượt băng',                   'cardio'),
  ('Squats',                          'Squat (đứng lên ngồi xuống)',            'lower_body'),
  ('Standing Knee to Elbow',          'Đứng chạm gối vào khuỷu tay',            'cardio'),
  ('Step Jacks',                      'Bước dang tay chân',                     'cardio'),
  ('Superman Extensions',             'Tư thế siêu nhân',                       'core'),
  ('Supine Dead Bug',                 'Tư thế bọ chết nằm ngửa',                'core'),
  ('Walking High Knees',              'Đi bộ nâng cao gối',                     'cardio'),
  ('Wall Press',                      'Đẩy tường',                              'upper_body'),
  ('Windmill Stretch',                'Giãn cơ xoay người kiểu cối xay gió',    'stretching')
ON CONFLICT (name_en) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Verify: mọi tên bài trong workout_templates.exercises.items PHẢI có bản dịch
-- (match case-insensitive). Kỳ vọng 0 bài thiếu.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_missing integer;
  v_missing_names text;
BEGIN
  WITH wt_names AS (
    SELECT DISTINCT (it ->> 'name') AS name_en
    FROM public.workout_templates wt,
         jsonb_array_elements(wt.exercises -> 'items') it
    WHERE wt.exercises IS NOT NULL
  )
  SELECT count(*), string_agg(n.name_en, ', ')
    INTO v_missing, v_missing_names
  FROM wt_names n
  WHERE NOT EXISTS (
    SELECT 1 FROM public.exercise_translations t
    WHERE LOWER(t.name_en) = LOWER(n.name_en)
  );

  IF v_missing > 0 THEN
    RAISE EXCEPTION 'Migration 069 verify failed: % bài chưa có bản dịch: %',
      v_missing, v_missing_names;
  END IF;
END $$;

COMMIT;
