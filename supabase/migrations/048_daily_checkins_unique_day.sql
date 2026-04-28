CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_checkins_unique_day
ON daily_checkins (enrollment_id, workout_date);
