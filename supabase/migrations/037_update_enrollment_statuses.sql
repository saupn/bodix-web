-- Migration: 037_update_enrollment_statuses
-- Thêm 2 statuses mới cho enrollment flow:
--   trial_completed   — xong 3 ngày trial, chờ được chọn vào cohort
--   paid_waiting_cohort — đã thanh toán, chờ cohort bắt đầu
--
-- Flow: trial → trial_completed → pending_payment → paid_waiting_cohort → active
--
-- Current statuses (003): trial, pending_payment, active, paused, completed, dropped
-- New statuses:           trial, trial_completed, pending_payment, paid_waiting_cohort, active, paused, completed, dropped

-- Drop inline check constraint (auto-named by PG)
ALTER TABLE public.enrollments
  DROP CONSTRAINT IF EXISTS enrollments_status_check;

-- Re-add with new statuses
ALTER TABLE public.enrollments
  ADD CONSTRAINT enrollments_status_check
  CHECK (status IN (
    'trial',
    'trial_completed',
    'pending_payment',
    'paid_waiting_cohort',
    'active',
    'paused',
    'completed',
    'dropped'
  ));
