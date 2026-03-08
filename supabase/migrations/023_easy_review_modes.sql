-- Migration 023: Add Easy/Review modes and seed 21-day workout structure
-- New mode system:
--   hard (3 rounds ~25min), light (2 rounds ~18min), easy (1 round ~10min),
--   recovery (Saturday ~15min), review (Sunday ~20-30min), skip

-- 1. Update daily_checkins mode constraint
ALTER TABLE public.daily_checkins DROP CONSTRAINT IF EXISTS daily_checkins_mode_check;
ALTER TABLE public.daily_checkins ADD CONSTRAINT daily_checkins_mode_check
  CHECK (mode IN ('hard', 'light', 'easy', 'recovery', 'review', 'skip'));

-- 2. Update workout_templates workout_type constraint
ALTER TABLE public.workout_templates DROP CONSTRAINT IF EXISTS workout_templates_workout_type_check;
ALTER TABLE public.workout_templates ADD CONSTRAINT workout_templates_workout_type_check
  CHECK (workout_type IN ('main', 'recovery', 'review', 'flexible'));

-- 3. Add new columns to streaks
ALTER TABLE public.streaks ADD COLUMN IF NOT EXISTS total_easy_days integer DEFAULT 0;
ALTER TABLE public.streaks ADD COLUMN IF NOT EXISTS total_review_days integer DEFAULT 0;

-- 4. review_content — coach review videos & notes per week
CREATE TABLE IF NOT EXISTS public.review_content (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id uuid REFERENCES public.programs(id) NOT NULL,
  week_number integer NOT NULL,
  review_video_url text,
  review_video_title text,
  review_video_duration integer,
  bodyscan_video_url text,
  bodyscan_duration integer DEFAULT 5,
  next_week_focus text,
  coach_note text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(program_id, week_number)
);
ALTER TABLE public.review_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view review content"
  ON public.review_content FOR SELECT USING (true);

-- 5. body_checks — weekly body scan self-assessment
CREATE TABLE IF NOT EXISTS public.body_checks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  week_number integer NOT NULL,
  shoulders integer DEFAULT 1 CHECK (shoulders BETWEEN 1 AND 3),
  upper_back integer DEFAULT 1,
  lower_back integer DEFAULT 1,
  core_area integer DEFAULT 1,
  glutes integer DEFAULT 1,
  quads integer DEFAULT 1,
  hamstrings integer DEFAULT 1,
  calves integer DEFAULT 1,
  arms integer DEFAULT 1,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(enrollment_id, week_number)
);
ALTER TABLE public.body_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own body checks"
  ON public.body_checks FOR ALL USING (auth.uid() = user_id);

-- 6. Seed review_content for BodiX 21
INSERT INTO public.review_content (program_id, week_number, review_video_title, review_video_duration, next_week_focus, coach_note)
SELECT id, 1,
  'Review Tuần 1: Xây dựng nền tảng', 10,
  'Tuần tới chú ý tốc độ — đếm 3 giây khi hạ, 1 giây khi đẩy',
  'Tuần 1 là tuần khó nhất. Bạn đã vượt qua rồi!'
FROM public.programs WHERE slug = 'bodix-21';

INSERT INTO public.review_content (program_id, week_number, review_video_title, review_video_duration, next_week_focus, coach_note)
SELECT id, 2,
  'Review Tuần 2: Bắt đầu tăng tải', 10,
  'Thử Hard ít nhất 3 buổi tuần tới. Bạn mạnh hơn bạn nghĩ!',
  'Cơ thể đang quen dần. Đẩy thêm một chút nhé!'
FROM public.programs WHERE slug = 'bodix-21';

INSERT INTO public.review_content (program_id, week_number, review_video_title, review_video_duration, next_week_focus, coach_note)
SELECT id, 3,
  'Review Tuần 3: Tuần cuối — Hoàn thành!', 12,
  'Chụp ảnh "sau" và so sánh với ngày đầu!',
  'Hoàn thành là điều kiện cần. Kết quả là hệ quả.'
FROM public.programs WHERE slug = 'bodix-21';

-- 7. Re-seed workout_templates for BodiX 21 (21 days = 3 weeks × 7 days)
-- Each week: 5 main sessions + 1 recovery (Sat) + 1 review (Sun)
DELETE FROM public.workout_templates
  WHERE program_id = (SELECT id FROM public.programs WHERE slug = 'bodix-21');

DO $$
DECLARE
  v_program_id uuid;
  v_week integer;
  v_base integer;
BEGIN
  SELECT id INTO v_program_id FROM public.programs WHERE slug = 'bodix-21';

  FOR v_week IN 1..3 LOOP
    v_base := (v_week - 1) * 7;

    INSERT INTO public.workout_templates
      (program_id, day_number, week_number, day_of_week, workout_type, title, description, duration_minutes, hard_version, light_version)
    VALUES
    -- Day 1 (Mon): Lower body
    (v_program_id, v_base+1, v_week, 1, 'main',
     'Phiên 1: Thân dưới', 'Tập trung mông, đùi, bắp chân', 25,
     '{"video_url":null,"rounds":3,"duration_minutes":25,"exercises":[{"name":"Squat","reps":12},{"name":"Lunge","reps":10},{"name":"Glute Bridge","reps":15},{"name":"Calf Raise","reps":20},{"name":"Wall Sit","duration_seconds":30}]}',
     '{"video_url":null,"rounds":2,"duration_minutes":18,"exercises":[{"name":"Squat","reps":12},{"name":"Lunge","reps":10},{"name":"Glute Bridge","reps":15},{"name":"Calf Raise","reps":20},{"name":"Wall Sit","duration_seconds":30}]}'),

    -- Day 2 (Tue): Upper body
    (v_program_id, v_base+2, v_week, 2, 'main',
     'Phiên 2: Thân trên', 'Tập trung vai, tay, ngực', 25,
     '{"video_url":null,"rounds":3,"duration_minutes":25,"exercises":[{"name":"Push-up","reps":10},{"name":"Tricep Dip","reps":12},{"name":"Shoulder Press","reps":10},{"name":"Arm Circle","reps":15},{"name":"Plank","duration_seconds":30}]}',
     '{"video_url":null,"rounds":2,"duration_minutes":18,"exercises":[{"name":"Push-up","reps":10},{"name":"Tricep Dip","reps":12},{"name":"Shoulder Press","reps":10},{"name":"Arm Circle","reps":15},{"name":"Plank","duration_seconds":30}]}'),

    -- Day 3 (Wed): Core & Cardio
    (v_program_id, v_base+3, v_week, 3, 'main',
     'Phiên 3: Bụng & Cardio', 'Tập trung vùng bụng và tim mạch', 25,
     '{"video_url":null,"rounds":3,"duration_minutes":25,"exercises":[{"name":"Crunch","reps":15},{"name":"Mountain Climber","reps":20},{"name":"Bicycle Crunch","reps":12},{"name":"High Knees","duration_seconds":30},{"name":"Plank Hold","duration_seconds":30}]}',
     '{"video_url":null,"rounds":2,"duration_minutes":18,"exercises":[{"name":"Crunch","reps":15},{"name":"Mountain Climber","reps":20},{"name":"Bicycle Crunch","reps":12},{"name":"High Knees","duration_seconds":30},{"name":"Plank Hold","duration_seconds":30}]}'),

    -- Day 4 (Thu): Full body
    (v_program_id, v_base+4, v_week, 4, 'main',
     'Phiên 4: Toàn thân', 'Kết hợp thân trên và thân dưới', 25,
     '{"video_url":null,"rounds":3,"duration_minutes":25,"exercises":[{"name":"Burpee","reps":8},{"name":"Squat to Press","reps":10},{"name":"Lunge to Twist","reps":10},{"name":"Plank to Push-up","reps":8},{"name":"Jump Squat","reps":10}]}',
     '{"video_url":null,"rounds":2,"duration_minutes":18,"exercises":[{"name":"Burpee","reps":8},{"name":"Squat to Press","reps":10},{"name":"Lunge to Twist","reps":10},{"name":"Plank to Push-up","reps":8},{"name":"Jump Squat","reps":10}]}'),

    -- Day 5 (Fri): HIIT
    (v_program_id, v_base+5, v_week, 5, 'main',
     'Phiên 5: Đốt mỡ HIIT', 'Tập cường độ cao ngắt quãng', 25,
     '{"video_url":null,"rounds":3,"duration_minutes":25,"exercises":[{"name":"Jumping Jack","duration_seconds":30},{"name":"Squat Jump","reps":12},{"name":"High Knees","duration_seconds":30},{"name":"Tuck Jump","reps":8},{"name":"Burpee","reps":6}]}',
     '{"video_url":null,"rounds":2,"duration_minutes":18,"exercises":[{"name":"Jumping Jack","duration_seconds":30},{"name":"Squat Jump","reps":12},{"name":"High Knees","duration_seconds":30},{"name":"Tuck Jump","reps":8},{"name":"Burpee","reps":6}]}'),

    -- Day 6 (Sat): Recovery
    (v_program_id, v_base+6, v_week, 6, 'recovery',
     'Phiên phục hồi', 'Giãn cơ và thư giãn', 15,
     '{"video_url":null,"rounds":1,"duration_minutes":15,"exercises":[{"name":"Cat-Cow Stretch","duration_seconds":30},{"name":"Child Pose","duration_seconds":30},{"name":"Hip Flexor Stretch","duration_seconds":30},{"name":"Seated Forward Fold","duration_seconds":30},{"name":"Savasana","duration_seconds":60}]}',
     NULL),

    -- Day 7 (Sun): Review
    (v_program_id, v_base+7, v_week, 7, 'review',
     'Review Chủ nhật', 'Nhìn lại tuần và chuẩn bị tuần mới', 25,
     NULL, NULL);
  END LOOP;
END $$;
