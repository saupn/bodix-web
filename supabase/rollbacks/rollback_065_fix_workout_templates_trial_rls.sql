-- DO NOT RUN AUTOMATICALLY.
-- rollback_065_fix_workout_templates_trial_rls.sql
-- Revert RLS policy của workout_templates về trạng thái trước migration 065
-- (chỉ status 'trial' và 'active' xem được workouts).
--
-- CẢNH BÁO: chạy rollback này sẽ TÁI XUẤT regression — user 'paid_waiting_cohort'
-- và 'pending_payment' sẽ KHÔNG xem được nội dung trial nữa.

BEGIN;

DROP POLICY IF EXISTS "Enrolled users view workouts" ON public.workout_templates;

CREATE POLICY "Enrolled users view workouts"
  ON public.workout_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.program_id = workout_templates.program_id
        AND e.user_id    = auth.uid()
        AND e.status IN ('trial', 'active')
    )
  );

-- Verify: policy đã revert (không còn paid_waiting_cohort).
DO $$
DECLARE
  expr text;
BEGIN
  SELECT pg_get_expr(polqual, polrelid) INTO expr
  FROM pg_policy
  WHERE polrelid = 'public.workout_templates'::regclass
    AND polname = 'Enrolled users view workouts';

  IF expr IS NULL THEN
    RAISE EXCEPTION 'Policy missing after rollback';
  END IF;
  IF position('paid_waiting_cohort' IN expr) > 0 THEN
    RAISE EXCEPTION 'Rollback failed: paid_waiting_cohort still present';
  END IF;
END $$;

COMMIT;
