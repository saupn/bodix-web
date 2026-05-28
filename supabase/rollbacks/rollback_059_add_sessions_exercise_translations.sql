-- DO NOT RUN AUTOMATICALLY. Manual rollback for migration 059.
-- ============================================================================
-- DELETE 15 rows được thêm trong migration 059.
--
-- Không drop bảng (rollback của 058 chịu trách nhiệm đó).
-- Không TRUNCATE — DELETE theo name_en để chỉ xoá đúng 15 row của 059,
-- không đụng 29 row của 058.
-- exercise_translations không có inbound FK nên DELETE an toàn.
-- ============================================================================

BEGIN;

DELETE FROM public.exercise_translations
WHERE name_en IN (
  'Light Burpee',
  'Cat-Cow',
  'Child''s Pose',
  'Dead Bug',
  'Hamstring Stretch',
  'Hip Opener',
  'Inchworm',
  'Knee Lift',
  'Low Jack',
  'Lunge Twist',
  'March in Place',
  'Plank Shoulder Tap',
  'Shoulder Stretch',
  'Side Step',
  'Step Touch'
);

-- Verify: phải còn lại đúng 29 row của migration 058
DO $$
DECLARE
  remaining_count INT;
BEGIN
  SELECT COUNT(*) INTO remaining_count FROM public.exercise_translations;
  IF remaining_count <> 29 THEN
    RAISE WARNING 'rollback_059: expected 29 rows remaining (migration 058 baseline), got % — kiểm tra lại lịch sử migration', remaining_count;
  END IF;
END $$;

COMMIT;
