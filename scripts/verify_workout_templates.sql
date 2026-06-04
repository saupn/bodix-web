-- scripts/verify_workout_templates.sql
-- ============================================================================
-- Verify thủ công sau khi chạy migration 068. Read-only — KHÔNG đổi dữ liệu.
-- Chạy: supabase db execute --file scripts/verify_workout_templates.sql
--   (hoặc paste vào SQL editor). Mỗi query in ra để mắt thường kiểm tra.
-- ============================================================================

\echo '=== 1. Cột cũ đã bị drop, cột exercises đã tồn tại ==='
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='workout_templates'
  AND column_name IN ('hard_version','light_version','recovery_version','exercises')
ORDER BY column_name;
-- Kỳ vọng: CHỈ còn 'exercises' (jsonb). 3 cột version không xuất hiện.

\echo '=== 2. bodix-21: mỗi ngày — title, video, số items, rounds, nhịp tập ==='
SELECT wt.day_number, wt.workout_type, wt.title,
       wt.exercises ->> 'video_url'                       AS video_url,
       (wt.exercises ->> 'duration_minutes')              AS dur_min,
       (wt.exercises ->> 'work_seconds')                  AS work_s,
       (wt.exercises ->> 'rest_seconds')                  AS rest_s,
       wt.exercises -> 'rounds'                           AS rounds,
       jsonb_array_length(wt.exercises -> 'items')        AS n_items,
       (SELECT string_agg(it ->> 'name', ', ')
          FROM jsonb_array_elements(wt.exercises -> 'items') it) AS items
FROM public.workout_templates wt
JOIN public.programs p ON p.id = wt.program_id
WHERE p.slug = 'bodix-21'
ORDER BY wt.day_number;
-- Kỳ vọng: 18 dòng non-review có 5 items tên THẬT; 3 review day exercises NULL.

\echo '=== 3. Mọi item chỉ có đúng 1 key "name" (không reps/sets/duration_seconds) ==='
SELECT count(*) AS bad_items
FROM public.workout_templates wt,
     jsonb_array_elements(COALESCE(wt.exercises -> 'items', '[]'::jsonb)) it
WHERE (SELECT count(*) FROM jsonb_object_keys(it)) <> 1
   OR it ->> 'name' IS NULL;
-- Kỳ vọng: 0

\echo '=== 4. Không còn tên placeholder cũ ==='
SELECT count(*) AS placeholder_hits
FROM public.workout_templates wt,
     jsonb_array_elements(COALESCE(wt.exercises -> 'items', '[]'::jsonb)) it
WHERE it ->> 'name' IN (
  'Calf Raise','Wall Sit','Tricep Dip','Shoulder Press','Arm Circle','Plank',
  'Jumping Jack','High Knees','Squat Jump','Burpee','Crunch','Plank Hold',
  'Squat to Press','Lunge to Twist','Plank to Push-up','Jump Squat',
  'Cat-Cow Stretch','Child Pose','Hip Flexor Stretch','Seated Forward Fold','Savasana',
  'Push-up','Lunge'
);
-- Kỳ vọng: 0 (toàn bộ placeholder đã thay).

\echo '=== 5. rounds đồng nhất hard:3 / light:2 / recovery:1 trên mọi dòng có exercises ==='
SELECT count(*) AS wrong_rounds
FROM public.workout_templates wt
WHERE wt.exercises IS NOT NULL
  AND (   (wt.exercises -> 'rounds' ->> 'hard')::int     <> 3
       OR (wt.exercises -> 'rounds' ->> 'light')::int    <> 2
       OR (wt.exercises -> 'rounds' ->> 'recovery')::int <> 1
       OR (wt.exercises ->> 'work_seconds')::int <> 60
       OR (wt.exercises ->> 'rest_seconds')::int <> 30);
-- Kỳ vọng: 0

\echo '=== 6. Backup tables còn nguyên (giữ >= 30 ngày) ==='
SELECT 'workout_templates' AS tbl, count(*) AS backup_rows FROM public.workout_templates_backup_20260604
UNION ALL
SELECT 'sessions', count(*) FROM public.sessions_backup_20260604;
-- Kỳ vọng: workout_templates=21, sessions=13

\echo '=== 7. sessions.exercises sau đồng bộ (A4/A5 phải có "Full Press-Up") ==='
SELECT code, level, exercises
FROM public.sessions
ORDER BY sort_order, code;
-- Kỳ vọng: A4/A5 item "Plank Dumbbell Renegade Row and Full Press-Up" (có gạch nối);
-- code 'F' giữ nguyên không đụng.

\echo '=== 8. PHASE 4 cross-check: workout_templates.items vs sessions.exercises ==='
WITH title_code(title, code) AS (
  VALUES
    ('Nền tảng thân dưới','A'),
    ('Thân trên & Tư thế','B'),
    ('Cardio nhẹ nhàng','C'),
    ('Cơ trung tâm & Cân bằng','D'),
    ('Toàn thân linh hoạt','E'),
    ('Phục hồi & Linh hoạt','R')
)
SELECT wt.day_number, wt.title, tc.code,
       ARRAY(SELECT it ->> 'name'
             FROM jsonb_array_elements(wt.exercises -> 'items') it) AS wt_items,
       s.exercises AS session_items
FROM public.workout_templates wt
JOIN public.programs p ON p.id = wt.program_id AND p.slug = 'bodix-21'
JOIN title_code tc ON tc.title = wt.title
JOIN public.sessions s ON s.code = tc.code
WHERE ARRAY(SELECT it ->> 'name'
            FROM jsonb_array_elements(wt.exercises -> 'items') it)
      IS DISTINCT FROM s.exercises
ORDER BY wt.day_number;
-- Kỳ vọng: 0 dòng (workout_templates khớp tuyệt đối sessions theo session-code).
