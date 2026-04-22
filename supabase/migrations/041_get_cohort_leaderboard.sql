-- Migration 041: get_cohort_leaderboard RPC
-- Used by /api/completion/cohort-board
-- Notes:
--   - daily_checkins.mode (not workout_mode). Valid values after migration 023:
--       'hard', 'light', 'easy', 'recovery', 'review', 'skip'
--   - profiles has no avatar_url; avatar comes from auth.users.raw_user_meta_data

CREATE OR REPLACE FUNCTION public.get_cohort_leaderboard(p_cohort_id uuid)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  avatar_url text,
  total_checkins bigint,
  current_streak integer,
  hard_count bigint,
  light_count bigint,
  easy_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.full_name,
    (au.raw_user_meta_data->>'avatar_url')::text AS avatar_url,
    COUNT(dc.id) AS total_checkins,
    COALESCE(s.current_streak, 0) AS current_streak,
    COUNT(dc.id) FILTER (WHERE dc.mode = 'hard')  AS hard_count,
    COUNT(dc.id) FILTER (WHERE dc.mode = 'light') AS light_count,
    COUNT(dc.id) FILTER (WHERE dc.mode = 'easy')  AS easy_count
  FROM public.enrollments e
  JOIN public.profiles p      ON p.id = e.user_id
  LEFT JOIN auth.users au     ON au.id = p.id
  LEFT JOIN public.daily_checkins dc ON dc.enrollment_id = e.id
  LEFT JOIN public.streaks s         ON s.enrollment_id = e.id
  WHERE e.cohort_id = p_cohort_id
    AND e.status = 'active'
  GROUP BY p.id, p.full_name, au.raw_user_meta_data, s.current_streak
  ORDER BY total_checkins DESC, current_streak DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cohort_leaderboard(uuid) TO authenticated, service_role;
