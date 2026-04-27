-- Migration 047: Add exercises to BodiX 21 workout_templates (English exercise names)
-- Migration 024 reseeded BodiX 21 without an `exercises` field in hard_version/light_version,
-- causing the workout page to render "Chưa có bài tập cho chế độ này".
-- This migration UPDATEs existing rows to merge an `exercises` array into the jsonb.
-- Rotation mirrors migration 024:
--   week 1: phien 1→2→3→4→5
--   week 2: phien 2→3→4→5→1
--   week 3: phien 3→4→5→1→2

DO $$
DECLARE
  v_pid uuid;
  v_week integer;
  v_idx integer;
  v_phien integer;
  v_day_num integer;
  v_exercises jsonb;
  v_exercises_by_phien jsonb := jsonb_build_object(
    '1', jsonb_build_array(
      -- Phien 1: Nền tảng thân dưới
      jsonb_build_object('name', 'Squat', 'sets', 3, 'reps', 12),
      jsonb_build_object('name', 'Lunge', 'sets', 3, 'reps', 10),
      jsonb_build_object('name', 'Glute Bridge', 'sets', 3, 'reps', 15),
      jsonb_build_object('name', 'Calf Raise', 'sets', 3, 'reps', 20),
      jsonb_build_object('name', 'Wall Sit', 'sets', 3, 'duration_seconds', 30)
    ),
    '2', jsonb_build_array(
      -- Phien 2: Thân trên & Tư thế
      jsonb_build_object('name', 'Push-up', 'sets', 3, 'reps', 10),
      jsonb_build_object('name', 'Tricep Dip', 'sets', 3, 'reps', 12),
      jsonb_build_object('name', 'Shoulder Press', 'sets', 3, 'reps', 10),
      jsonb_build_object('name', 'Arm Circle', 'sets', 3, 'reps', 15),
      jsonb_build_object('name', 'Plank', 'sets', 3, 'duration_seconds', 30)
    ),
    '3', jsonb_build_array(
      -- Phien 3: Cardio nhẹ nhàng
      jsonb_build_object('name', 'Jumping Jack', 'sets', 3, 'duration_seconds', 30),
      jsonb_build_object('name', 'Mountain Climber', 'sets', 3, 'reps', 20),
      jsonb_build_object('name', 'High Knees', 'sets', 3, 'duration_seconds', 30),
      jsonb_build_object('name', 'Squat Jump', 'sets', 3, 'reps', 12),
      jsonb_build_object('name', 'Burpee', 'sets', 3, 'reps', 8)
    ),
    '4', jsonb_build_array(
      -- Phien 4: Cơ trung tâm & Cân bằng
      jsonb_build_object('name', 'Crunch', 'sets', 3, 'reps', 15),
      jsonb_build_object('name', 'Bicycle Crunch', 'sets', 3, 'reps', 12),
      jsonb_build_object('name', 'Plank Hold', 'sets', 3, 'duration_seconds', 30),
      jsonb_build_object('name', 'Side Plank', 'sets', 3, 'duration_seconds', 20),
      jsonb_build_object('name', 'Bird Dog', 'sets', 3, 'reps', 12)
    ),
    '5', jsonb_build_array(
      -- Phien 5: Toàn thân linh hoạt
      jsonb_build_object('name', 'Burpee', 'sets', 3, 'reps', 8),
      jsonb_build_object('name', 'Squat to Press', 'sets', 3, 'reps', 10),
      jsonb_build_object('name', 'Lunge to Twist', 'sets', 3, 'reps', 10),
      jsonb_build_object('name', 'Plank to Push-up', 'sets', 3, 'reps', 8),
      jsonb_build_object('name', 'Jump Squat', 'sets', 3, 'reps', 10)
    )
  );
  v_recovery_exercises jsonb := jsonb_build_array(
    jsonb_build_object('name', 'Cat-Cow Stretch', 'sets', 1, 'duration_seconds', 30),
    jsonb_build_object('name', 'Child Pose', 'sets', 1, 'duration_seconds', 30),
    jsonb_build_object('name', 'Hip Flexor Stretch', 'sets', 1, 'duration_seconds', 30),
    jsonb_build_object('name', 'Seated Forward Fold', 'sets', 1, 'duration_seconds', 30),
    jsonb_build_object('name', 'Savasana', 'sets', 1, 'duration_seconds', 60)
  );
  v_rotations integer[][] := ARRAY[
    ARRAY[1,2,3,4,5],
    ARRAY[2,3,4,5,1],
    ARRAY[3,4,5,1,2]
  ];
BEGIN
  SELECT id INTO v_pid FROM public.programs WHERE slug = 'bodix-21';
  IF v_pid IS NULL THEN
    RAISE NOTICE 'BodiX 21 program not found, skipping';
    RETURN;
  END IF;

  -- Main sessions (5 per week × 3 weeks)
  FOR v_week IN 1..3 LOOP
    FOR v_idx IN 1..5 LOOP
      v_phien := v_rotations[v_week][v_idx];
      v_day_num := (v_week - 1) * 7 + v_idx;
      v_exercises := v_exercises_by_phien -> v_phien::text;

      UPDATE public.workout_templates
      SET hard_version = COALESCE(hard_version, '{}'::jsonb)
                       || jsonb_build_object('exercises', v_exercises),
          light_version = COALESCE(light_version, '{}'::jsonb)
                        || jsonb_build_object('exercises', v_exercises)
      WHERE program_id = v_pid AND day_number = v_day_num;
    END LOOP;

    -- Recovery (day 6 of each week) — exercises live on hard_version per migration 024
    UPDATE public.workout_templates
    SET hard_version = COALESCE(hard_version, '{}'::jsonb)
                     || jsonb_build_object('exercises', v_recovery_exercises)
    WHERE program_id = v_pid AND day_number = (v_week - 1) * 7 + 6;
  END LOOP;
END $$;
