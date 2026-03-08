-- supabase/seed.sql
-- Seed data: BodiX Programs, BodiX 21 workout templates (21 days), Cohort
-- Run: npx supabase db reset
-- Or apply manually: npx supabase db execute --file supabase/seed.sql

-- ===========================================================================
-- 1. Programs (upsert)
-- ===========================================================================

insert into public.programs
  (slug, name, description, duration_days, price_vnd, sort_order, features)
values
  (
    'bodix-21',
    'BodiX 21',
    '21 ngày tạo thói quen. Lần đầu hoàn thành.',
    21, 599000, 1,
    '["5 buổi chính + 1 Recovery mỗi tuần", "Không cần dụng cụ", "Hard & Light version mỗi buổi", "Theo dõi streak hàng ngày"]'
  ),
  (
    'bodix-6w',
    'BodiX 6W',
    '6 tuần thay đổi rõ rệt. Bắt đầu thấy khác.',
    42, 1299000, 2,
    '["5 buổi chính + 1 Recovery mỗi tuần", "Cần thảm và tạ nhẹ", "Hard & Light version mỗi buổi", "Review tuần hàng tuần", "Check-in ảnh tiến trình"]'
  ),
  (
    'bodix-12w',
    'BodiX 12W',
    '12 tuần lột xác có kiểm soát.',
    84, 2499000, 3,
    '["5 buổi chính + 1 Recovery mỗi tuần", "Cần thảm, tạ, dây kháng lực", "Hard & Light version mỗi buổi", "Review tuần + tháng", "Check-in ảnh tiến trình", "1-on-1 check-in"]'
  )
on conflict (slug) do update set
  name          = excluded.name,
  description   = excluded.description,
  duration_days = excluded.duration_days,
  price_vnd     = excluded.price_vnd,
  sort_order    = excluded.sort_order,
  features      = excluded.features;

-- ===========================================================================
-- 2. Workout templates: BodiX 21 (3 weeks x 7 days = 21 days)
--    Structure per week:
--      Mon (dow=1): main   — Lower Body
--      Tue (dow=2): main   — Upper Body
--      Wed (dow=3): main   — Core & Cardio
--      Thu (dow=4): main   — Full Body
--      Fri (dow=5): main   — HIIT / Burn
--      Sat (dow=6): recovery — Active Recovery
--      Sun (dow=7): flexible — Ngay Linh Hoat
--    Progression: duration W1=30 min, W2=35 min, W3=40 min
--                 sets/reps increase each week
-- ===========================================================================

do $$
declare
  p21 uuid;
begin
  select id into p21 from public.programs where slug = 'bodix-21';
  if p21 is null then
    raise exception 'Program bodix-21 not found. Run programs seed first.';
  end if;

  delete from public.workout_templates where program_id = p21;

  insert into public.workout_templates
    (program_id, day_number, week_number, day_of_week,
     workout_type, title, description, duration_minutes,
     hard_version, light_version, recovery_version, sort_order)
  values

  --------------------------------------------------------------------------
  -- TUAN 1  (days 1-7, week_number=1)
  --------------------------------------------------------------------------

  -- Day 1: Mon — Lower Body
  (p21, 1, 1, 1, 'main',
   'Ngay 1: Lower Body - Nen Tang',
   'Kich hoat co dui, mong va bap chan. Tap trung vao ky thuat dung.',
   30,
   '{"video_url":null,"exercises":[{"name":"Squat","sets":3,"reps":15},{"name":"Reverse Lunge","sets":3,"reps":12},{"name":"Glute Bridge","sets":3,"reps":15},{"name":"Sumo Squat","sets":3,"reps":12},{"name":"Calf Raise","sets":3,"reps":20}]}'::jsonb,
   '{"video_url":null,"exercises":[{"name":"Squat","sets":3,"reps":10},{"name":"Reverse Lunge","sets":3,"reps":8},{"name":"Glute Bridge","sets":3,"reps":12},{"name":"Calf Raise","sets":3,"reps":15}]}'::jsonb,
   null, 1),

  -- Day 2: Tue — Upper Body
  (p21, 2, 1, 2, 'main',
   'Ngay 2: Upper Body - Kich Hoat',
   'Tang cuong co nguc, tay sau va vai. Bat dau nhe nhang.',
   30,
   '{"video_url":null,"exercises":[{"name":"Push-up","sets":3,"reps":12},{"name":"Tricep Dip","sets":3,"reps":12},{"name":"Plank Shoulder Tap","sets":3,"reps":10},{"name":"Wide Push-up","sets":3,"reps":10},{"name":"Arm Circle","sets":2,"duration_seconds":30}]}'::jsonb,
   '{"video_url":null,"exercises":[{"name":"Knee Push-up","sets":3,"reps":10},{"name":"Tricep Dip","sets":3,"reps":10},{"name":"Plank","sets":3,"duration_seconds":20},{"name":"Arm Circle","sets":2,"duration_seconds":30}]}'::jsonb,
   null, 2),

  -- Day 3: Wed — Core & Cardio
  (p21, 3, 1, 3, 'main',
   'Ngay 3: Core & Cardio - Dot Chay',
   'Ket hop bai tap core voi cardio nhe de dot mo va tang suc ben.',
   30,
   '{"video_url":null,"exercises":[{"name":"Crunch","sets":3,"reps":20},{"name":"Plank","sets":3,"duration_seconds":30},{"name":"Mountain Climber","sets":3,"reps":20},{"name":"Leg Raise","sets":3,"reps":15},{"name":"Bicycle Crunch","sets":3,"reps":20}]}'::jsonb,
   '{"video_url":null,"exercises":[{"name":"Crunch","sets":3,"reps":15},{"name":"Plank","sets":3,"duration_seconds":20},{"name":"Mountain Climber","sets":3,"reps":15},{"name":"Leg Raise","sets":3,"reps":10}]}'::jsonb,
   null, 3),

  -- Day 4: Thu — Full Body
  (p21, 4, 1, 4, 'main',
   'Ngay 4: Full Body Circuit',
   'Buoi tap tong hop toan than. Ket hop cardio va suc manh.',
   30,
   '{"video_url":null,"exercises":[{"name":"Burpee","sets":3,"reps":8},{"name":"Squat","sets":3,"reps":15},{"name":"Push-up","sets":3,"reps":10},{"name":"High Knees","sets":3,"duration_seconds":30},{"name":"Mountain Climber","sets":3,"reps":20}]}'::jsonb,
   '{"video_url":null,"exercises":[{"name":"Modified Burpee","sets":3,"reps":6},{"name":"Squat","sets":3,"reps":12},{"name":"Knee Push-up","sets":3,"reps":8},{"name":"Marching in Place","sets":3,"duration_seconds":30}]}'::jsonb,
   null, 4),

  -- Day 5: Fri — HIIT / Burn
  (p21, 5, 1, 5, 'main',
   'Ngay 5: HIIT Burn - Tuan 1',
   'Ket thuc tuan bang buoi HIIT cuong do cao. Dot het nang luong.',
   30,
   '{"video_url":null,"exercises":[{"name":"Jump Squat","sets":4,"reps":12},{"name":"Mountain Climber","sets":4,"reps":20},{"name":"Burpee","sets":4,"reps":6},{"name":"High Knees","sets":4,"duration_seconds":30},{"name":"Jump Lunge","sets":4,"reps":10}]}'::jsonb,
   '{"video_url":null,"exercises":[{"name":"Squat Pulse","sets":4,"reps":20},{"name":"Mountain Climber","sets":4,"reps":15},{"name":"Step-back Lunge","sets":4,"reps":10},{"name":"Marching in Place","sets":4,"duration_seconds":30}]}'::jsonb,
   null, 5),

  -- Day 6: Sat — Recovery
  (p21, 6, 1, 6, 'recovery',
   'Ngay 6: Active Recovery',
   'Gian co va phuc hoi. De co the hap thu ket qua cua 5 ngay tap.',
   20,
   null, null,
   '{"video_url":null,"exercises":[{"name":"Cat-Cow","sets":2,"reps":10},{"name":"Child Pose","sets":2,"duration_seconds":30},{"name":"Hip Flexor Stretch","sets":2,"duration_seconds":30},{"name":"Pigeon Pose","sets":2,"duration_seconds":30},{"name":"Shoulder Roll","sets":2,"reps":15}]}'::jsonb,
   6),

  -- Day 7: Sun — Flexible
  (p21, 7, 1, 7, 'flexible',
   'Ngay 7: Ngay Linh Hoat',
   'Tu do lua chon: di bo, dap xe, boi loi, hoac nghi ngoi hoan toan.',
   20,
   null,
   '{"video_url":null,"exercises":[{"name":"Di bo nhe","sets":1,"duration_seconds":1200},{"name":"Full Body Stretch","sets":1,"duration_seconds":900}]}'::jsonb,
   null, 7),

  --------------------------------------------------------------------------
  -- TUAN 2  (days 8-14, week_number=2)
  --------------------------------------------------------------------------

  -- Day 8: Mon — Lower Body
  (p21, 8, 2, 1, 'main',
   'Ngay 8: Lower Body - Xay Dung',
   'Tang cuong do. Them bai don chan de kich thich co sau hon.',
   35,
   '{"video_url":null,"exercises":[{"name":"Squat","sets":3,"reps":20},{"name":"Walking Lunge","sets":3,"reps":12},{"name":"Single-leg Glute Bridge","sets":3,"reps":12},{"name":"Sumo Squat Pulse","sets":3,"reps":20},{"name":"Calf Raise","sets":3,"reps":25}]}'::jsonb,
   '{"video_url":null,"exercises":[{"name":"Squat","sets":3,"reps":12},{"name":"Walking Lunge","sets":3,"reps":10},{"name":"Glute Bridge","sets":3,"reps":15},{"name":"Calf Raise","sets":3,"reps":20}]}'::jsonb,
   null, 1),

  -- Day 9: Tue — Upper Body
  (p21, 9, 2, 2, 'main',
   'Ngay 9: Upper Body - Day Manh',
   'Them push-up bien the. Tang suc manh co nguc va tay sau.',
   35,
   '{"video_url":null,"exercises":[{"name":"Push-up","sets":3,"reps":15},{"name":"Diamond Push-up","sets":3,"reps":10},{"name":"Tricep Dip","sets":3,"reps":15},{"name":"Pike Push-up","sets":3,"reps":10},{"name":"Plank Shoulder Tap","sets":3,"reps":12}]}'::jsonb,
   '{"video_url":null,"exercises":[{"name":"Knee Push-up","sets":3,"reps":12},{"name":"Tricep Dip","sets":3,"reps":12},{"name":"Plank","sets":3,"duration_seconds":25},{"name":"Arm Circle","sets":2,"duration_seconds":30}]}'::jsonb,
   null, 2),

  -- Day 10: Wed — Core & Cardio
  (p21, 10, 2, 3, 'main',
   'Ngay 10: Core & Cardio - Day Gioi Han',
   'Core manh hon, cardio lau hon. Tang thoi gian plank va so rep.',
   35,
   '{"video_url":null,"exercises":[{"name":"Crunch","sets":3,"reps":25},{"name":"Plank","sets":3,"duration_seconds":45},{"name":"Mountain Climber","sets":3,"reps":25},{"name":"Leg Raise","sets":3,"reps":20},{"name":"Russian Twist","sets":3,"reps":20}]}'::jsonb,
   '{"video_url":null,"exercises":[{"name":"Crunch","sets":3,"reps":20},{"name":"Plank","sets":3,"duration_seconds":30},{"name":"Mountain Climber","sets":3,"reps":20},{"name":"Leg Raise","sets":3,"reps":12}]}'::jsonb,
   null, 3),

  -- Day 11: Thu — Full Body
  (p21, 11, 2, 4, 'main',
   'Ngay 11: Full Body - Tang Toc',
   'Tang cuong do full body. Them bai nhay de dot calo nhieu hon.',
   35,
   '{"video_url":null,"exercises":[{"name":"Burpee","sets":3,"reps":10},{"name":"Jump Squat","sets":3,"reps":12},{"name":"Push-up","sets":3,"reps":12},{"name":"High Knees","sets":3,"duration_seconds":40},{"name":"Reverse Lunge","sets":3,"reps":12}]}'::jsonb,
   '{"video_url":null,"exercises":[{"name":"Modified Burpee","sets":3,"reps":8},{"name":"Squat","sets":3,"reps":15},{"name":"Knee Push-up","sets":3,"reps":10},{"name":"Marching in Place","sets":3,"duration_seconds":40}]}'::jsonb,
   null, 4),

  -- Day 12: Fri — HIIT / Burn
  (p21, 12, 2, 5, 'main',
   'Ngay 12: HIIT Burn - Tuan 2',
   'HIIT cuong do cao hon tuan truoc. Moi vong tang 2-3 rep.',
   35,
   '{"video_url":null,"exercises":[{"name":"Jump Squat","sets":4,"reps":15},{"name":"Mountain Climber","sets":4,"reps":25},{"name":"Burpee","sets":4,"reps":8},{"name":"High Knees","sets":4,"duration_seconds":40},{"name":"Jump Lunge","sets":4,"reps":12}]}'::jsonb,
   '{"video_url":null,"exercises":[{"name":"Squat Pulse","sets":4,"reps":25},{"name":"Mountain Climber","sets":4,"reps":20},{"name":"Step-back Lunge","sets":4,"reps":12},{"name":"Marching in Place","sets":4,"duration_seconds":40}]}'::jsonb,
   null, 5),

  -- Day 13: Sat — Recovery
  (p21, 13, 2, 6, 'recovery',
   'Ngay 13: Active Recovery',
   'Gian co sau sau tuan tap cuong do cao hon.',
   20,
   null, null,
   '{"video_url":null,"exercises":[{"name":"Cat-Cow","sets":2,"reps":10},{"name":"Child Pose","sets":2,"duration_seconds":30},{"name":"Hip Flexor Stretch","sets":2,"duration_seconds":30},{"name":"Pigeon Pose","sets":2,"duration_seconds":30},{"name":"Shoulder Roll","sets":2,"reps":15}]}'::jsonb,
   6),

  -- Day 14: Sun — Flexible
  (p21, 14, 2, 7, 'flexible',
   'Ngay 14: Ngay Linh Hoat',
   'Hon nua chang duong roi. Nghi ngoi hoac van dong nhe tuy cam giac.',
   20,
   null,
   '{"video_url":null,"exercises":[{"name":"Di bo nhe","sets":1,"duration_seconds":1200},{"name":"Full Body Stretch","sets":1,"duration_seconds":900}]}'::jsonb,
   null, 7),

  --------------------------------------------------------------------------
  -- TUAN 3  (days 15-21, week_number=3)
  --------------------------------------------------------------------------

  -- Day 15: Mon — Lower Body
  (p21, 15, 3, 1, 'main',
   'Ngay 15: Lower Body - Dinh Cao',
   'Tuan cuoi - day het suc. Tap trung vao form va khong bo rep nao.',
   40,
   '{"video_url":null,"exercises":[{"name":"Jump Squat","sets":4,"reps":12},{"name":"Walking Lunge","sets":4,"reps":12},{"name":"Single-leg Glute Bridge","sets":4,"reps":12},{"name":"Sumo Squat","sets":4,"reps":15},{"name":"Calf Raise","sets":4,"reps":25}]}'::jsonb,
   '{"video_url":null,"exercises":[{"name":"Squat","sets":4,"reps":12},{"name":"Reverse Lunge","sets":4,"reps":10},{"name":"Glute Bridge","sets":4,"reps":12},{"name":"Calf Raise","sets":4,"reps":20}]}'::jsonb,
   null, 1),

  -- Day 16: Tue — Upper Body
  (p21, 16, 3, 2, 'main',
   'Ngay 16: Upper Body - Tong Ket',
   'Ket hop tat ca push-up variation da hoc. Thach thuc gioi han co nguc.',
   40,
   '{"video_url":null,"exercises":[{"name":"Push-up","sets":4,"reps":12},{"name":"Diamond Push-up","sets":4,"reps":10},{"name":"Pike Push-up","sets":4,"reps":10},{"name":"Tricep Dip","sets":4,"reps":15},{"name":"Plank Shoulder Tap","sets":4,"reps":12}]}'::jsonb,
   '{"video_url":null,"exercises":[{"name":"Push-up","sets":3,"reps":10},{"name":"Tricep Dip","sets":3,"reps":12},{"name":"Plank","sets":3,"duration_seconds":30},{"name":"Arm Circle","sets":2,"duration_seconds":30}]}'::jsonb,
   null, 2),

  -- Day 17: Wed — Core & Cardio
  (p21, 17, 3, 3, 'main',
   'Ngay 17: Core & Cardio - Hoan Thien',
   'Core tuan 3 nang nhat. Them hollow hold va flutter kick.',
   40,
   '{"video_url":null,"exercises":[{"name":"Bicycle Crunch","sets":4,"reps":20},{"name":"Plank","sets":4,"duration_seconds":45},{"name":"Mountain Climber","sets":4,"reps":25},{"name":"Leg Raise","sets":4,"reps":20},{"name":"Hollow Hold","sets":4,"duration_seconds":20}]}'::jsonb,
   '{"video_url":null,"exercises":[{"name":"Crunch","sets":4,"reps":15},{"name":"Plank","sets":4,"duration_seconds":30},{"name":"Mountain Climber","sets":4,"reps":15},{"name":"Leg Raise","sets":4,"reps":12}]}'::jsonb,
   null, 3),

  -- Day 18: Thu — Full Body
  (p21, 18, 3, 4, 'main',
   'Ngay 18: Full Body - But Pha',
   'Full body cuong do toi da. So sanh voi ngay 4 va ngay 11 de thay ban tien bo.',
   40,
   '{"video_url":null,"exercises":[{"name":"Burpee","sets":4,"reps":10},{"name":"Jump Squat","sets":4,"reps":12},{"name":"Push-up","sets":4,"reps":12},{"name":"High Knees","sets":4,"duration_seconds":40},{"name":"Lunge Jump","sets":4,"reps":10}]}'::jsonb,
   '{"video_url":null,"exercises":[{"name":"Modified Burpee","sets":4,"reps":8},{"name":"Squat","sets":4,"reps":12},{"name":"Knee Push-up","sets":4,"reps":10},{"name":"Marching in Place","sets":4,"duration_seconds":40}]}'::jsonb,
   null, 4),

  -- Day 19: Fri — HIIT / Burn
  (p21, 19, 3, 5, 'main',
   'Ngay 19: HIIT Burn - Tuan 3',
   'Ap chot. HIIT cao nhat trong toan chuong trinh. De lai tat ca suc luc o day.',
   40,
   '{"video_url":null,"exercises":[{"name":"Jump Squat","sets":4,"reps":20},{"name":"Mountain Climber","sets":4,"reps":30},{"name":"Burpee","sets":4,"reps":10},{"name":"High Knees","sets":4,"duration_seconds":45},{"name":"Jump Lunge","sets":4,"reps":15}]}'::jsonb,
   '{"video_url":null,"exercises":[{"name":"Squat Pulse","sets":4,"reps":25},{"name":"Mountain Climber","sets":4,"reps":20},{"name":"Step-back Lunge","sets":4,"reps":15},{"name":"Marching in Place","sets":4,"duration_seconds":45}]}'::jsonb,
   null, 5),

  -- Day 20: Sat — Recovery (before final day)
  (p21, 20, 3, 6, 'recovery',
   'Ngay 20: Active Recovery - Chuan Bi Ngay Cuoi',
   'Gian co ky truoc ngay cuoi cung. Nghi ngoi va sac lai nang luong.',
   20,
   null, null,
   '{"video_url":null,"exercises":[{"name":"Cat-Cow","sets":2,"reps":10},{"name":"Child Pose","sets":2,"duration_seconds":30},{"name":"Hip Flexor Stretch","sets":2,"duration_seconds":30},{"name":"Pigeon Pose","sets":2,"duration_seconds":30},{"name":"Shoulder Roll","sets":2,"reps":15}]}'::jsonb,
   6),

  -- Day 21: Sun — Flexible (completion day)
  (p21, 21, 3, 7, 'flexible',
   'Ngay 21: Hoan Thanh - Lan Dau Tien',
   'Ban da hoan thanh BodiX 21. Hom nay la ngay cua ban. Can nhan su thay doi.',
   25,
   null,
   '{"video_url":null,"exercises":[{"name":"Celebration Walk","sets":1,"duration_seconds":1800},{"name":"Full Body Stretch","sets":1,"duration_seconds":1200}]}'::jsonb,
   null, 7);

end;
$$;

-- ===========================================================================
-- 3. Cohort: BodiX 21 Dot 1
--    start_date: 2026-04-15 (ngay 15 thang 4)
--    end_date:   2026-05-06 (start + 21 ngay)
-- ===========================================================================

do $$
declare
  p21 uuid;
begin
  select id into p21 from public.programs where slug = 'bodix-21';

  insert into public.cohorts (program_id, name, start_date, end_date, max_members, status)
  values (
    p21,
    'BodiX 21 - Dot 1',
    '2026-04-15',
    '2026-05-06',
    30,
    'upcoming'
  );
end;
$$;
