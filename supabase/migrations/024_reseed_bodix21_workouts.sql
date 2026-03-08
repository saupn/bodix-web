-- Re-seed BodiX 21 workout templates with real Vimeo URLs and Vietnamese session names
-- Rotation: A→B→C→D→E per week, shifted each week

DELETE FROM public.workout_templates WHERE program_id = (SELECT id FROM public.programs WHERE slug = 'bodix-21');

DO $$
DECLARE
  v_pid uuid;
  v_week integer;
  v_base integer;
  v_urls text[] := ARRAY[
    'https://vimeo.com/1169317064/e0a82f5344',
    'https://vimeo.com/1169317210/227fb73582',
    'https://vimeo.com/1169317274/42f46543a5',
    'https://vimeo.com/1169317372/4fb61db503',
    'https://vimeo.com/1169317406/e53a1410d5'
  ];
  v_names_vi text[] := ARRAY[
    'Nền tảng thân dưới',
    'Thân trên & Tư thế',
    'Cardio nhẹ nhàng',
    'Cơ trung tâm & Cân bằng',
    'Toàn thân linh hoạt'
  ];
  v_recovery_url text := 'https://vimeo.com/1169317473/61c7f1223d';
  v_rotations integer[][] := ARRAY[
    ARRAY[1,2,3,4,5],
    ARRAY[2,3,4,5,1],
    ARRAY[3,4,5,1,2]
  ];
  v_idx integer;
  v_vid text;
  v_name text;
BEGIN
  SELECT id INTO v_pid FROM public.programs WHERE slug = 'bodix-21';

  FOR v_week IN 1..3 LOOP
    v_base := (v_week - 1) * 7;

    FOR v_idx IN 1..5 LOOP
      v_vid := v_urls[v_rotations[v_week][v_idx]];
      v_name := v_names_vi[v_rotations[v_week][v_idx]];

      INSERT INTO public.workout_templates
        (program_id, day_number, week_number, day_of_week, workout_type, title, duration_minutes, hard_version, light_version)
      VALUES
        (v_pid, v_base + v_idx, v_week, v_idx, 'main', v_name, 21,
         jsonb_build_object('video_url', v_vid, 'rounds', 3, 'duration_minutes', 21),
         jsonb_build_object('video_url', v_vid, 'rounds', 2, 'duration_minutes', 14));
    END LOOP;

    INSERT INTO public.workout_templates
      (program_id, day_number, week_number, day_of_week, workout_type, title, duration_minutes, hard_version)
    VALUES
      (v_pid, v_base + 6, v_week, 6, 'recovery', 'Phục hồi & Linh hoạt', 7,
       jsonb_build_object('video_url', v_recovery_url, 'rounds', 1, 'duration_minutes', 7));

    INSERT INTO public.workout_templates
      (program_id, day_number, week_number, day_of_week, workout_type, title, duration_minutes)
    VALUES
      (v_pid, v_base + 7, v_week, 7, 'review', 'Review Chủ nhật', 25);
  END LOOP;
END $$;
