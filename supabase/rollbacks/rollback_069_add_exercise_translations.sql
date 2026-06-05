-- DO NOT RUN AUTOMATICALLY.
-- ============================================================================
-- Rollback Migration 069: xóa 23 bản dịch đã thêm.
--
-- An toàn: migration 069 là INSERT thuần với ON CONFLICT DO NOTHING. Rollback
-- chỉ DELETE đúng 23 name_en này. KHÔNG dùng TRUNCATE (bảng có thể bị tham chiếu
-- gián tiếp; chỉ xóa đúng các dòng đã insert).
--
-- ⚠️ Lưu ý: nếu một trong 23 tên này đã tồn tại TRƯỚC 069 (ON CONFLICT giữ dòng
-- cũ), DELETE dưới đây vẫn xóa nó. Thực tế kiểm tra production: cả 23 tên đều
-- mới (068 mới đưa vào). Nếu cần thận trọng tuyệt đối, soi lại trước khi chạy.
-- ============================================================================

BEGIN;

DELETE FROM public.exercise_translations
WHERE name_en IN (
  'Arm Circles',
  'Child Pose into Cobra Flow',
  'Extended Crunch',
  'Good Morning Prisoner',
  'High Knee March',
  'Knee Push Up',
  'Knee Push Up Rotations',
  'Reverse Lunge',
  'Reverse Lunge Knee Lift',
  'Reverse Woodchop',
  'Romanian Deadlift',
  'Run In Place',
  'Seated Lateral Overhead Stretch',
  'Side Lunge',
  'Skater Jump',
  'Squats',
  'Standing Knee to Elbow',
  'Step Jacks',
  'Superman Extensions',
  'Supine Dead Bug',
  'Walking High Knees',
  'Wall Press',
  'Windmill Stretch'
);

-- Verify: 23 tên đã bị xóa hết.
DO $$
DECLARE
  v_left integer;
BEGIN
  SELECT count(*) INTO v_left
  FROM public.exercise_translations
  WHERE name_en IN (
    'Arm Circles','Child Pose into Cobra Flow','Extended Crunch',
    'Good Morning Prisoner','High Knee March','Knee Push Up',
    'Knee Push Up Rotations','Reverse Lunge','Reverse Lunge Knee Lift',
    'Reverse Woodchop','Romanian Deadlift','Run In Place',
    'Seated Lateral Overhead Stretch','Side Lunge','Skater Jump','Squats',
    'Standing Knee to Elbow','Step Jacks','Superman Extensions',
    'Supine Dead Bug','Walking High Knees','Wall Press','Windmill Stretch'
  );
  IF v_left > 0 THEN
    RAISE EXCEPTION 'rollback 069 verify failed: còn % dòng chưa xóa', v_left;
  END IF;
END $$;

COMMIT;
