-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 032: Weekly Review System V2
-- - user_questions: Thu thập câu hỏi từ user
-- - review_videos: Video review cuối tuần
-- - weekly_reviews: Thêm cột cho video review + feeling
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 1. Bảng thu thập câu hỏi/vấn đề từ user
CREATE TABLE IF NOT EXISTS public.user_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid REFERENCES enrollments(id),
  user_id uuid NOT NULL REFERENCES profiles(id),
  cohort_id uuid REFERENCES cohorts(id),
  week_number int NOT NULL,
  message_type text NOT NULL CHECK (message_type IN ('text', 'image', 'video', 'voice')),
  content text,
  media_url text,
  category text CHECK (category IN ('form_check', 'pain_injury', 'nutrition', 'motivation', 'schedule', 'other')),
  status text DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'answered_in_video', 'answered_direct')),
  admin_notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_cohort_week ON user_questions(cohort_id, week_number);
CREATE INDEX IF NOT EXISTS idx_questions_status ON user_questions(status);

-- RLS
ALTER TABLE public.user_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own questions"
  ON public.user_questions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on user_questions"
  ON public.user_questions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- 2. Bảng video review
CREATE TABLE IF NOT EXISTS public.review_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid REFERENCES cohorts(id),
  program_id uuid REFERENCES programs(id),
  week_number int NOT NULL,
  video_url text NOT NULL,
  title text NOT NULL,
  description text,
  topics_covered text[],
  duration_minutes int,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'sent')),
  published_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.review_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published review_videos"
  ON public.review_videos FOR SELECT
  USING (status IN ('published', 'sent'));

CREATE POLICY "Service role full access on review_videos"
  ON public.review_videos FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- 3. Thêm cột vào weekly_reviews (bảng đã tồn tại)
ALTER TABLE public.weekly_reviews
  ADD COLUMN IF NOT EXISTS review_video_id uuid REFERENCES review_videos(id),
  ADD COLUMN IF NOT EXISTS feeling_score int CHECK (feeling_score BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS feeling_replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS week_easy_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_streak int DEFAULT 0;
