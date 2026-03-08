-- Backfill onboarding_completed for users who already completed onboarding.
-- A user has completed onboarding if they filled in date_of_birth and gender
-- (set during the onboarding flow), or if they have any enrollment.

update public.profiles
set onboarding_completed = true
where onboarding_completed = false
  and (
    -- Completed the onboarding form (date_of_birth + gender set)
    (date_of_birth is not null and gender is not null)
    -- Or has any enrollment (definitely past onboarding)
    or id in (select distinct user_id from public.enrollments)
  );
