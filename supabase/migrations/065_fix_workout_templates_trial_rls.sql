-- 065_fix_workout_templates_trial_rls.sql
-- Sửa RLS policy của workout_templates để user đã thanh toán xem được nội dung trial.
--
-- ROOT CAUSE (regression /trial không hiện Ngày 1,2,3):
--   Policy cũ "Enrolled users view workouts" chỉ cho phép enrollment.status
--   IN ('trial','active'). API /api/trial/workouts dùng anon client (RLS-respecting),
--   nên user status='paid_waiting_cohort' (hoặc 'pending_payment') bị RLS lọc sạch
--   → query workout_templates trả 0 row → cả 3 ngày trial render "locked".
--
--   App-level canAccessTrialContent() / TRIAL_ACCESSIBLE_STATUSES đã cho phép
--   ('trial','pending_payment','paid_waiting_cohort') nhưng RLS chưa đồng bộ.
--
-- FIX: mở rộng status trong policy cho khớp TRIAL_ACCESSIBLE_STATUSES.
--   Trial day 1/2/3 là content cố định, độc lập cohort/current_day — chỉ cần
--   user còn quyền truy cập trial là xem được.
--
-- Chỉ đổi RLS policy (DDL) — không động dữ liệu. Không cần backup table.

DROP POLICY IF EXISTS "Enrolled users view workouts" ON public.workout_templates;

CREATE POLICY "Enrolled users view workouts"
  ON public.workout_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.program_id = workout_templates.program_id
        AND e.user_id    = auth.uid()
        AND e.status IN ('trial', 'pending_payment', 'paid_waiting_cohort', 'active')
    )
  );

-- Verify: policy tồn tại với điều kiện mới.
DO $$
DECLARE
  expr text;
BEGIN
  SELECT pg_get_expr(polqual, polrelid) INTO expr
  FROM pg_policy
  WHERE polrelid = 'public.workout_templates'::regclass
    AND polname = 'Enrolled users view workouts';

  IF expr IS NULL THEN
    RAISE EXCEPTION 'Policy "Enrolled users view workouts" missing after migration';
  END IF;
  IF position('paid_waiting_cohort' IN expr) = 0 THEN
    RAISE EXCEPTION 'Policy did not pick up paid_waiting_cohort status';
  END IF;
END $$;
