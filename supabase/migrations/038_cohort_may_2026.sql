-- Đợt tập tháng 5/2026 (BodiX 21) — idempotent
INSERT INTO public.cohorts (program_id, name, start_date, end_date, max_members, status)
SELECT
  p.id,
  'Đợt tập tháng 5/2026',
  '2026-05-04'::date,
  ('2026-05-04'::date + interval '21 days')::date,
  50,
  'upcoming'
FROM public.programs p
WHERE p.slug = 'bodix-21'
  AND NOT EXISTS (
    SELECT 1 FROM public.cohorts c
    WHERE c.program_id = p.id AND c.start_date = '2026-05-04'::date
  );
