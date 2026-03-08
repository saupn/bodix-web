-- Migration: 012_review_system
-- Requires: 003_create_program_engine (enrollments, cohorts), 005_create_completion_engine

-- ============================================
-- 1. WEEKLY REVIEWS
-- ============================================
create table public.weekly_reviews (
  id uuid default gen_random_uuid() primary key,
  enrollment_id uuid references public.enrollments(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  week_number integer not null,

  -- Đánh giá
  fatigue_level integer check (fatigue_level between 1 and 5),
    -- 1=Rất mệt, 2=Khá mệt, 3=Vừa phải, 4=Khỏe, 5=Tràn đầy năng lượng
  progress_feeling integer check (progress_feeling between 1 and 5),
    -- 1=Không thấy gì, 2=Hơi khác, 3=Thấy khác, 4=Khác rõ, 5=Thay đổi lớn
  difficulty_rating integer check (difficulty_rating between 1 and 5),
    -- 1=Quá dễ, 2=Dễ, 3=Vừa, 4=Khó, 5=Quá khó

  -- Câu hỏi mở
  body_changes text,          -- "Bạn thấy cơ thể thay đổi gì tuần này?"
  biggest_challenge text,     -- "Thử thách lớn nhất tuần này?"
  next_week_goal text,        -- "Mục tiêu tuần tới?"

  -- Metrics tự động (system fill khi tạo review)
  week_completion_rate numeric(5,1),  -- % ngày hoàn thành trong tuần
  week_hard_count integer default 0,
  week_light_count integer default 0,
  week_recovery_count integer default 0,
  week_skip_count integer default 0,
  avg_feeling numeric(3,1),           -- trung bình feeling trong tuần

  -- Gợi ý từ hệ thống
  system_suggestion text,     -- "Tuần tới thử tăng 1 buổi Hard" hoặc "Giữ nguyên nhịp, đang tốt"
  intensity_adjustment text check (intensity_adjustment in ('increase', 'maintain', 'decrease')),

  submitted_at timestamptz default now(),
  created_at timestamptz default now(),

  unique(enrollment_id, week_number)
);

-- ============================================
-- 2. MID-PROGRAM REFLECTIONS
-- ============================================
create table public.mid_program_reflections (
  id uuid default gen_random_uuid() primary key,
  enrollment_id uuid references public.enrollments(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,

  -- So sánh ảnh
  before_photo_url text,       -- URL ảnh "before" (upload đầu chương trình)
  midpoint_photo_url text,     -- URL ảnh giữa chương trình

  -- Đánh giá tiến bộ
  overall_progress integer check (overall_progress between 1 and 10),
    -- 1=Không thay đổi → 10=Thay đổi rất lớn
  visible_changes text[],      -- ['Giảm mỡ bụng', 'Săn chắc đùi', 'Tăng sức bền', ...]

  -- Đánh giá lại mục tiêu
  original_goal text,          -- mục tiêu ban đầu (từ onboarding)
  goal_still_relevant boolean default true,
  updated_goal text,           -- mục tiêu mới (nếu thay đổi)

  -- Điều chỉnh cường độ
  wants_intensity_change text check (wants_intensity_change in ('more_hard', 'keep_same', 'more_light')),

  -- Feedback
  what_works_well text,        -- "Điều gì hiệu quả nhất?"
  what_to_improve text,        -- "Điều gì cần cải thiện?"
  would_recommend boolean,     -- NPS proxy
  recommendation_score integer check (recommendation_score between 0 and 10),  -- NPS score

  submitted_at timestamptz default now(),
  created_at timestamptz default now(),

  unique(enrollment_id)  -- chỉ 1 mid-program reflection per enrollment
);

-- ============================================
-- 3. PROGRESS PHOTOS
-- ============================================
create table public.progress_photos (
  id uuid default gen_random_uuid() primary key,
  enrollment_id uuid references public.enrollments(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  photo_type text not null check (photo_type in ('before', 'midpoint', 'after', 'weekly')),
  photo_url text not null,
  week_number integer,         -- null cho before/after, có giá trị cho weekly/midpoint
  notes text,
  is_public boolean default false,  -- user cho phép chia sẻ lên community không
  uploaded_at timestamptz default now()
);

-- ============================================
-- 4. COMMUNITY POSTS (cho in-app community)
-- ============================================
create table public.community_posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  cohort_id uuid references public.cohorts(id),
  post_type text not null check (post_type in (
    'completion_share',    -- chia sẻ hoàn thành ngày/tuần
    'milestone_share',     -- chia sẻ milestone
    'progress_photo',      -- chia sẻ ảnh tiến bộ
    'motivation',          -- chia sẻ động lực
    'question',            -- hỏi đáp
    'program_complete'     -- hoàn thành chương trình
  )),
  content text,
  media_urls text[],           -- ảnh/video đính kèm
  milestone_type text,         -- nếu post_type = 'milestone_share'
  likes_count integer default 0,
  is_pinned boolean default false,
  is_hidden boolean default false,  -- admin ẩn nếu vi phạm
  created_at timestamptz default now()
);

-- ============================================
-- 5. COMMUNITY REACTIONS
-- ============================================
create table public.community_reactions (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.community_posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  reaction_type text default 'like' check (reaction_type in ('like', 'fire', 'clap', 'heart')),
  created_at timestamptz default now(),
  unique(post_id, user_id)  -- 1 reaction per user per post
);

-- ============================================
-- RLS POLICIES
-- ============================================
alter table public.weekly_reviews enable row level security;
alter table public.mid_program_reflections enable row level security;
alter table public.progress_photos enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_reactions enable row level security;

-- Weekly reviews: user quản lý review của mình
create policy "Users manage own weekly reviews" on public.weekly_reviews
  for all using (auth.uid() = user_id);

-- Mid-program: user quản lý của mình
create policy "Users manage own reflections" on public.mid_program_reflections
  for all using (auth.uid() = user_id);

-- Progress photos: user quản lý của mình
create policy "Users manage own photos" on public.progress_photos
  for all using (auth.uid() = user_id);

-- Community posts: user thấy posts trong cohort của mình + posts public
create policy "Users view cohort posts" on public.community_posts
  for select using (
    is_hidden = false and (
      cohort_id is null  -- public posts
      or exists (
        select 1 from public.enrollments
        where enrollments.cohort_id = community_posts.cohort_id
        and enrollments.user_id = auth.uid()
        and enrollments.status in ('active', 'completed')
      )
    )
  );

create policy "Users create posts" on public.community_posts
  for insert with check (auth.uid() = user_id);

-- Reactions: user quản lý reactions của mình, đọc tất cả
create policy "Users manage own reactions" on public.community_reactions
  for all using (auth.uid() = user_id);

create policy "Anyone view reactions" on public.community_reactions
  for select using (true);

-- ============================================
-- INDEXES
-- ============================================
create index idx_weekly_reviews_enrollment on public.weekly_reviews(enrollment_id);
create index idx_reflections_enrollment on public.mid_program_reflections(enrollment_id);
create index idx_photos_enrollment on public.progress_photos(enrollment_id, photo_type);
create index idx_community_posts_cohort on public.community_posts(cohort_id, created_at desc);
create index idx_community_reactions_post on public.community_reactions(post_id);

-- ============================================
-- STORAGE BUCKET cho progress photos
-- ============================================
-- Chạy lệnh sau trong Supabase Dashboard → Storage:
--   1. Tạo bucket: "progress-photos" (private)
--   2. Storage policy — authenticated users upload own files:
--        bucket_id = 'progress-photos'
--        AND (storage.foldername(name))[1] = auth.uid()::text
--   3. Storage policy — authenticated users read own files (same condition)
--   4. Max file size: 5 MB
--   5. Accepted MIME types: image/jpeg, image/png, image/webp
