-- Migration 042: update get_cohort_leaderboard
-- Changes vs 041:
--   * Alias total_checkins -> total_completed (clients read total_completed).
--   * Add deterministic rank via ROW_NUMBER() with tie-breaker (p.id).
--   * Guard duplicate enrollments per user via DISTINCT ON in a subquery,
--     picking the most recently created active enrollment.

DROP FUNCTION IF EXISTS public.get_cohort_leaderboard(uuid);

CREATE OR REPLACE FUNCTION public.get_cohort_leaderboard(p_cohort_id uuid)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  avatar_url text,
  total_completed bigint,
  current_streak integer,
  hard_count bigint,
  light_count bigint,
  easy_count bigint,
  rank bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH active_enrollment AS (
    SELECT DISTINCT ON (e.user_id)
      e.id,
      e.user_id
    FROM public.enrollments e
    WHERE e.cohort_id = p_cohort_id
      AND e.status = 'active'
    ORDER BY e.user_id, e.created_at DESC
  ),
  stats AS (
    SELECT
      p.id AS user_id,
      p.full_name,
      (au.raw_user_meta_data->>'avatar_url')::text AS avatar_url,
      COUNT(dc.id) AS total_completed,
      COALESCE(s.current_streak, 0) AS current_streak,
      COUNT(dc.id) FILTER (WHERE dc.mode = 'hard')  AS hard_count,
      COUNT(dc.id) FILTER (WHERE dc.mode = 'light') AS light_count,
      COUNT(dc.id) FILTER (WHERE dc.mode = 'easy')  AS easy_count
    FROM active_enrollment ae
    JOIN public.profiles p             ON p.id = ae.user_id
    LEFT JOIN auth.users au            ON au.id = p.id
    LEFT JOIN public.daily_checkins dc ON dc.enrollment_id = ae.id
    LEFT JOIN public.streaks s         ON s.enrollment_id = ae.id
    GROUP BY p.id, p.full_name, au.raw_user_meta_data, s.current_streak
  )
  SELECT
    stats.user_id,
    stats.full_name,
    stats.avatar_url,
    stats.total_completed,
    stats.current_streak,
    stats.hard_count,
    stats.light_count,
    stats.easy_count,
    ROW_NUMBER() OVER (
      ORDER BY stats.total_completed DESC,
               stats.current_streak DESC,
               stats.user_id
    ) AS rank
  FROM stats
  ORDER BY rank;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cohort_leaderboard(uuid) TO authenticated, service_role;
