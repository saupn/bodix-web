-- Enable Realtime for daily_checkins (for cohort board live updates)
alter publication supabase_realtime add table public.daily_checkins;
