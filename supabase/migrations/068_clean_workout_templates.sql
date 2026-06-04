-- Migration 068: Làm sạch workout_templates
-- ============================================================================
-- MỤC TIÊU
--   1. Thay 3 cột JSONB version (hard_version / light_version / recovery_version)
--      bằng MỘT cột `exercises` (JSONB) duy nhất.
--   2. Sửa tên bài tập placeholder (Squat/Lunge/Push-up...) → tên THẬT khớp video
--      (bản đồ chuẩn S1–S6 cơ bản). Mỗi item CHỈ có "name" — KHÔNG reps/sets.
--   3. PHASE 4: đồng bộ sessions.exercises theo CÙNG bản đồ (sửa lệch A4/A5).
--      sessions = canonical catalog; workout_templates.exercises.items = copy.
--      Code 'F' mồ côi giữ nguyên. Cross-check 0 lệch trong STEP 3 + verify script.
--
-- NHỊP TẬP (hằng số chung mọi phiên):
--   work_seconds = 60, rest_seconds = 30.
--   Số lượt phân biệt mode: rounds = { hard:3, light:2, recovery:1 } — đồng nhất
--   cho MỌI session (kể cả recovery day, theo quyết định sản phẩm).
--
-- CẤU TRÚC cột exercises mới:
--   {
--     "video_url": "...",                 -- giữ từ hard_version cũ
--     "duration_minutes": 21,             -- giữ từ cột duration_minutes
--     "work_seconds": 60,
--     "rest_seconds": 30,
--     "rounds": { "hard": 3, "light": 2, "recovery": 1 },
--     "items": [ { "name": "..." }, ... ] -- chỉ name, tiếng Anh
--   }
--
-- PHẠM VI: CHỈ bodix-21 (21 dòng hiện có). bodix-6w / bodix-12w (advanced A1–A6)
--   sẽ được seed ở migration SAU khi chốt khung tuần — dùng cùng cột `exercises`.
--
-- Review day (workout_type='review', title 'Review Chủ nhật'): KHÔNG có bài/không
--   video → exercises để NULL (frontend đã xử lý danh sách rỗng).
--
-- ⚠️ DEPLOY CONTRACT: migration này DROP 3 cột cũ ở bước cuối. Code đọc cột cũ sẽ
--   lỗi ngay khi cột bị drop. Hãy deploy build mới (Phase 3, đọc `exercises`) NGAY
--   sau khi `supabase db push`. Nếu muốn an toàn tuyệt đối (zero-downtime), comment
--   khối "STEP 4 — DROP" lại, deploy code, rồi chạy drop ở migration kế tiếp.
--
-- An toàn dữ liệu: backup full bảng trước khi sửa (giữ ≥ 30 ngày). Rollback:
--   supabase/rollbacks/rollback_068_clean_workout_templates.sql
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- STEP 0 — Backup full bảng (theo Migration convention)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.workout_templates_backup_20260604;
CREATE TABLE public.workout_templates_backup_20260604 AS
  SELECT * FROM public.workout_templates;

-- Backup sessions trước khi đồng bộ exercises (Phase 4).
DROP TABLE IF EXISTS public.sessions_backup_20260604;
CREATE TABLE public.sessions_backup_20260604 AS
  SELECT * FROM public.sessions;

-- ---------------------------------------------------------------------------
-- STEP 1 — Thêm cột mới
-- ---------------------------------------------------------------------------
ALTER TABLE public.workout_templates
  ADD COLUMN IF NOT EXISTS exercises jsonb;

-- ---------------------------------------------------------------------------
-- STEP 2 — Seed bodix-21 (map literal theo title → session)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_pid uuid;
  v_const jsonb := jsonb_build_object(
    'work_seconds', 60,
    'rest_seconds', 30,
    'rounds', jsonb_build_object('hard', 3, 'light', 2, 'recovery', 1)
  );
  -- Bản đồ items theo TITLE (tên tiếng Anh thật, khớp video). Chỉ field "name".
  v_items_by_title jsonb := jsonb_build_object(
    -- S1 — Nền tảng thân dưới
    'Nền tảng thân dưới', jsonb_build_array(
      jsonb_build_object('name', 'Squats'),
      jsonb_build_object('name', 'Good Morning Prisoner'),
      jsonb_build_object('name', 'Reverse Lunge'),
      jsonb_build_object('name', 'Glute Bridge'),
      jsonb_build_object('name', 'Romanian Deadlift')
    ),
    -- S2 — Thân trên & Tư thế
    'Thân trên & Tư thế', jsonb_build_array(
      jsonb_build_object('name', 'Wall Press'),
      jsonb_build_object('name', 'Knee Push Up Rotations'),
      jsonb_build_object('name', 'Mountain Climber'),
      jsonb_build_object('name', 'Superman Extensions'),
      jsonb_build_object('name', 'Bird Dog')
    ),
    -- S3 — Cardio nhẹ nhàng
    'Cardio nhẹ nhàng', jsonb_build_array(
      jsonb_build_object('name', 'Standing Knee to Elbow'),
      jsonb_build_object('name', 'Skater Jump'),
      jsonb_build_object('name', 'Step Jacks'),
      jsonb_build_object('name', 'Run In Place'),
      jsonb_build_object('name', 'Side Lunge')
    ),
    -- S4 — Cơ trung tâm & Cân bằng (Core và Ổn Định)
    'Cơ trung tâm & Cân bằng', jsonb_build_array(
      jsonb_build_object('name', 'Reverse Woodchop'),
      jsonb_build_object('name', 'Extended Crunch'),
      jsonb_build_object('name', 'Supine Dead Bug'),
      jsonb_build_object('name', 'Bird Dog'),
      jsonb_build_object('name', 'Side Plank')
    ),
    -- S5 — Toàn thân linh hoạt
    'Toàn thân linh hoạt', jsonb_build_array(
      jsonb_build_object('name', 'Walking High Knees'),
      jsonb_build_object('name', 'Squat'),
      jsonb_build_object('name', 'Reverse Lunge Knee Lift'),
      jsonb_build_object('name', 'Knee Push Up'),
      jsonb_build_object('name', 'Bicycle Crunch')
    ),
    -- S6 — Phục hồi & Linh hoạt (recovery)
    'Phục hồi & Linh hoạt', jsonb_build_array(
      jsonb_build_object('name', 'Seated Lateral Overhead Stretch'),
      jsonb_build_object('name', 'High Knee March'),
      jsonb_build_object('name', 'Windmill Stretch'),
      jsonb_build_object('name', 'Child Pose into Cobra Flow'),
      jsonb_build_object('name', 'Arm Circles')
    )
  );
  v_updated integer;
BEGIN
  SELECT id INTO v_pid FROM public.programs WHERE slug = 'bodix-21';
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'Migration 068: program bodix-21 không tồn tại';
  END IF;

  -- Các dòng có session map (main + recovery). Review day không khớp → bỏ qua (NULL).
  UPDATE public.workout_templates wt
  SET exercises = v_const
    || jsonb_build_object(
         'video_url', wt.hard_version ->> 'video_url',
         'duration_minutes', wt.duration_minutes,
         'items', v_items_by_title -> wt.title
       )
  WHERE wt.program_id = v_pid
    AND v_items_by_title ? wt.title;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Migration 068: seeded % bodix-21 rows (expected 18)', v_updated;
  IF v_updated <> 18 THEN
    RAISE EXCEPTION 'Migration 068: expected 18 seeded rows, got %', v_updated;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- STEP 2b — PHASE 4: đồng bộ sessions.exercises theo CÙNG bản đồ chuẩn.
--   sessions = canonical catalog (source of truth tên bài theo session-code);
--   workout_templates.exercises.items = bản denormalized phải khớp.
--   Sửa lệch A4/A5 ('Full Press Up' → 'Full Press-Up' theo map). Code 'F' mồ côi:
--   KHÔNG đụng (giữ nguyên theo quyết định sản phẩm).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_by_code jsonb := jsonb_build_object(
    -- Cơ bản: A=S1, B=S2, C=S3, D=S4, E=S5, R=S6
    'A', jsonb_build_array('Squats','Good Morning Prisoner','Reverse Lunge','Glute Bridge','Romanian Deadlift'),
    'B', jsonb_build_array('Wall Press','Knee Push Up Rotations','Mountain Climber','Superman Extensions','Bird Dog'),
    'C', jsonb_build_array('Standing Knee to Elbow','Skater Jump','Step Jacks','Run In Place','Side Lunge'),
    'D', jsonb_build_array('Reverse Woodchop','Extended Crunch','Supine Dead Bug','Bird Dog','Side Plank'),
    'E', jsonb_build_array('Walking High Knees','Squat','Reverse Lunge Knee Lift','Knee Push Up','Bicycle Crunch'),
    'R', jsonb_build_array('Seated Lateral Overhead Stretch','High Knee March','Windmill Stretch','Child Pose into Cobra Flow','Arm Circles'),
    -- Nâng cao A1–A6
    'A1', jsonb_build_array('Shuffle Squat','Romanian Deadlift','Split Squat','Sumo Jacks','Glute Bridge'),
    'A2', jsonb_build_array('Push Ups','Bent Over Row','Alternating Lateral Raise','Dumbbell Seated Overhead Press','Burpees'),
    'A3', jsonb_build_array('Squat Thrusts','Step Jacks High Intensity','Mountain Climber','Side Lunge','Run In Place'),
    'A4', jsonb_build_array('Plank Shoulder Tap','Plank Dumbbell Renegade Row and Full Press-Up','Slamball Russian Twist','Side Plank Rotation','Sit Up Rotation'),
    'A5', jsonb_build_array('Squat Thrusts','Reverse Lunge','Plank Dumbbell Renegade Row and Full Press-Up','Burpees','Dumbbell Romanian Deadlift'),
    'A6', jsonb_build_array('Burpees','Squat Jump','Quick Lateral Tap Knee Drive','Side Jump','Broad Jump 180')
  );
  v_code text;
  v_updated integer := 0;
  v_n integer;
BEGIN
  FOR v_code IN SELECT jsonb_object_keys(v_by_code) LOOP
    UPDATE public.sessions
    SET exercises = ARRAY(
      SELECT jsonb_array_elements_text(v_by_code -> v_code)
    )
    WHERE code = v_code;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_updated := v_updated + v_n;
  END LOOP;

  RAISE NOTICE 'Migration 068: synced % sessions rows (expected 12; F không đụng)', v_updated;
  IF v_updated <> 12 THEN
    RAISE EXCEPTION 'Migration 068: expected 12 synced sessions, got %', v_updated;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- STEP 3 — Verify trước khi drop cột cũ
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_pid uuid;
  v_bad integer;
  v_review_non_null integer;
BEGIN
  SELECT id INTO v_pid FROM public.programs WHERE slug = 'bodix-21';

  -- Mọi dòng non-review phải có exactly 5 items, mỗi item chỉ có key "name",
  -- và nhịp tập/rounds đúng hằng số.
  SELECT count(*) INTO v_bad
  FROM public.workout_templates wt
  WHERE wt.program_id = v_pid
    AND wt.workout_type <> 'review'
    AND (
         wt.exercises IS NULL
      OR jsonb_array_length(wt.exercises -> 'items') <> 5
      OR (wt.exercises ->> 'work_seconds')::int <> 60
      OR (wt.exercises ->> 'rest_seconds')::int <> 30
      OR (wt.exercises -> 'rounds' ->> 'hard')::int <> 3
      OR (wt.exercises -> 'rounds' ->> 'light')::int <> 2
      OR (wt.exercises -> 'rounds' ->> 'recovery')::int <> 1
      OR (wt.exercises ->> 'video_url') IS NULL
      OR EXISTS (
           SELECT 1 FROM jsonb_array_elements(wt.exercises -> 'items') it
           WHERE (SELECT count(*) FROM jsonb_object_keys(it)) <> 1
              OR it ->> 'name' IS NULL
         )
    );
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Migration 068 verify: % dòng non-review sai cấu trúc exercises', v_bad;
  END IF;

  -- Review day phải để NULL.
  SELECT count(*) INTO v_review_non_null
  FROM public.workout_templates wt
  WHERE wt.program_id = v_pid
    AND wt.workout_type = 'review'
    AND wt.exercises IS NOT NULL;
  IF v_review_non_null > 0 THEN
    RAISE EXCEPTION 'Migration 068 verify: % review day không NULL', v_review_non_null;
  END IF;

  -- PHASE 4 cross-check: items của workout_templates (basic, map theo title→code)
  -- phải KHỚP đúng thứ tự với sessions.exercises. Kỳ vọng 0 dòng lệch.
  IF EXISTS (
    WITH title_code(title, code) AS (
      VALUES
        ('Nền tảng thân dưới','A'),
        ('Thân trên & Tư thế','B'),
        ('Cardio nhẹ nhàng','C'),
        ('Cơ trung tâm & Cân bằng','D'),
        ('Toàn thân linh hoạt','E'),
        ('Phục hồi & Linh hoạt','R')
    )
    SELECT 1
    FROM public.workout_templates wt
    JOIN title_code tc ON tc.title = wt.title
    JOIN public.sessions s ON s.code = tc.code
    WHERE wt.program_id = v_pid
      AND ARRAY(SELECT it ->> 'name'
                FROM jsonb_array_elements(wt.exercises -> 'items') it)
          IS DISTINCT FROM s.exercises
  ) THEN
    RAISE EXCEPTION 'Migration 068 verify: workout_templates items lệch sessions.exercises';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- STEP 4 — DROP 3 cột cũ
--   (Comment khối này lại nếu muốn deploy code trước rồi drop ở migration sau.)
-- ---------------------------------------------------------------------------
ALTER TABLE public.workout_templates DROP COLUMN IF EXISTS hard_version;
ALTER TABLE public.workout_templates DROP COLUMN IF EXISTS light_version;
ALTER TABLE public.workout_templates DROP COLUMN IF EXISTS recovery_version;

COMMIT;
