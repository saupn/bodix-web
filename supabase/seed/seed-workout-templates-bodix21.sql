-- Seed: BodiX 21 workout_templates with Vimeo video URLs
-- Source of truth: lib/workout/video-config.ts
--
-- Schedule (3 weeks, 7 days each):
--   Days 1-5: main workouts (rotation A→E shifted per week)
--   Day 6:    recovery (Session F)
--   Day 7:    review (no video)
--
-- Duration per video = 7 min/round
--   hard  = 3 rounds = 21 min
--   light = 2 rounds = 14 min
--   recovery = 1 round = 7 min
--
-- SAFE: checks for existing rows before inserting.
-- IDEMPOTENT: re-runnable — skips if data already exists.

DO $$
DECLARE
  v_pid uuid;
  v_existing_count integer;

  -- Video URLs (A-E main, F recovery)
  v_url_a text := 'https://vimeo.com/1169317064/e0a82f5344';
  v_url_b text := 'https://vimeo.com/1169317210/227fb73582';
  v_url_c text := 'https://vimeo.com/1169317274/42f46543a5';
  v_url_d text := 'https://vimeo.com/1169317372/4fb61db503';
  v_url_e text := 'https://vimeo.com/1169317406/e53a1410d5';
  v_url_f text := 'https://vimeo.com/1169317473/61c7f1223d';

  -- Vietnamese session names (A-E)
  v_name_a text := 'Nền tảng thân dưới';
  v_name_b text := 'Thân trên & Tư thế';
  v_name_c text := 'Cardio nhẹ nhàng';
  v_name_d text := 'Cơ trung tâm & Cân bằng';
  v_name_e text := 'Toàn thân linh hoạt';

  -- Arrays for rotation lookup (index 1-5 = A-E)
  v_urls  text[] := ARRAY[v_url_a, v_url_b, v_url_c, v_url_d, v_url_e];
  v_names text[] := ARRAY[v_name_a, v_name_b, v_name_c, v_name_d, v_name_e];

  -- Rotation per week (matches getBodix21Schedule in video-config.ts)
  --   Week 1: A B C D E  → indices 1,2,3,4,5
  --   Week 2: B C D E A  → indices 2,3,4,5,1
  --   Week 3: C D E A B  → indices 3,4,5,1,2
  v_rotations integer[][] := ARRAY[
    ARRAY[1,2,3,4,5],
    ARRAY[2,3,4,5,1],
    ARRAY[3,4,5,1,2]
  ];

  v_week    integer;
  v_day_idx integer;
  v_base    integer;
  v_rot_idx integer;
  v_vid     text;
  v_title   text;
BEGIN
  -- 1. Resolve program_id
  SELECT id INTO v_pid FROM public.programs WHERE slug = 'bodix-21';
  IF v_pid IS NULL THEN
    RAISE NOTICE 'Program bodix-21 not found — skipping seed.';
    RETURN;
  END IF;

  -- 2. Check existing rows
  SELECT count(*) INTO v_existing_count
    FROM public.workout_templates
   WHERE program_id = v_pid;

  IF v_existing_count > 0 THEN
    RAISE NOTICE 'workout_templates already has % rows for bodix-21 — skipping seed.', v_existing_count;
    RETURN;
  END IF;

  -- 3. Insert 21 days (5 main + 1 recovery + 1 review per week)
  FOR v_week IN 1..3 LOOP
    v_base := (v_week - 1) * 7;

    -- Days 1-5: main workouts
    FOR v_day_idx IN 1..5 LOOP
      v_rot_idx := v_rotations[v_week][v_day_idx];
      v_vid     := v_urls[v_rot_idx];
      v_title   := v_names[v_rot_idx];

      INSERT INTO public.workout_templates
        (program_id, day_number, week_number, day_of_week, workout_type,
         title, duration_minutes, hard_version, light_version)
      VALUES
        (v_pid, v_base + v_day_idx, v_week, v_day_idx, 'main',
         v_title, 21,
         jsonb_build_object('video_url', v_vid, 'rounds', 3, 'duration_minutes', 21),
         jsonb_build_object('video_url', v_vid, 'rounds', 2, 'duration_minutes', 14));
    END LOOP;

    -- Day 6: recovery (Session F)
    INSERT INTO public.workout_templates
      (program_id, day_number, week_number, day_of_week, workout_type,
       title, duration_minutes, hard_version)
    VALUES
      (v_pid, v_base + 6, v_week, 6, 'recovery',
       'Phục hồi & Linh hoạt', 7,
       jsonb_build_object('video_url', v_url_f, 'rounds', 1, 'duration_minutes', 7));

    -- Day 7: review (no video)
    INSERT INTO public.workout_templates
      (program_id, day_number, week_number, day_of_week, workout_type,
       title, duration_minutes)
    VALUES
      (v_pid, v_base + 7, v_week, 7, 'review',
       'Review Chủ nhật', 25);
  END LOOP;

  RAISE NOTICE 'Seeded 21 workout_templates for bodix-21.';
END $$;
