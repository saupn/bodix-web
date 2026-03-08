import type { SupabaseClient } from "@supabase/supabase-js";

export interface MyStatsData {
  enrollment_id: string;
  cohort_id: string | null;
  program_name: string;
  current_day: number;
  total_days: number;
  streak: {
    current_streak: number;
    longest_streak: number;
    total_completed_days: number;
  };
  completion_rate: number;
  milestones: { milestone_type: string; achieved_at: string }[];
  checkins: { day_number: number; mode: string; feeling: number | null }[];
}

export async function getMyStats(
  supabase: SupabaseClient
): Promise<MyStatsData | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("id, current_day, started_at, cohort_id, programs(name, duration_days)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (enrollmentError || !enrollment) return null;

  const program = enrollment.programs as unknown as {
    name: string;
    duration_days: number;
  };
  const enrollmentId = enrollment.id;

  const [streakResult, checkinsResult, milestonesResult, rateResult] =
    await Promise.all([
      supabase
        .from("streaks")
        .select(
          "current_streak, longest_streak, total_completed_days"
        )
        .eq("enrollment_id", enrollmentId)
        .maybeSingle(),

      supabase
        .from("daily_checkins")
        .select("day_number, mode, feeling")
        .eq("enrollment_id", enrollmentId)
        .order("day_number", { ascending: true }),

      supabase
        .from("completion_milestones")
        .select("milestone_type, achieved_at")
        .eq("enrollment_id", enrollmentId)
        .order("achieved_at", { ascending: true }),

      supabase.rpc("get_completion_rate", { p_enrollment_id: enrollmentId }),
    ]);

  const rateData = rateResult.data as Record<string, unknown> | null;
  const completionRate: number =
    typeof rateData?.completion_rate === "number" ? rateData.completion_rate : 0;

  return {
    enrollment_id: enrollmentId,
    cohort_id: enrollment.cohort_id ?? null,
    program_name: program.name,
    current_day: enrollment.current_day ?? 0,
    total_days: program.duration_days,
    streak: streakResult.data ?? {
      current_streak: 0,
      longest_streak: 0,
      total_completed_days: 0,
    },
    completion_rate: completionRate,
    milestones: milestonesResult.data ?? [],
    checkins: checkinsResult.data ?? [],
  };
}

export type HistoryDayStatus =
  | "completed"
  | "missed"
  | "upcoming"
  | "today"
  | "rest_day";

export interface HistoryDay {
  day_number: number;
  date: string;
  status: HistoryDayStatus;
  mode: string | null;
  feeling: number | null;
}

export async function getHistory(
  supabase: SupabaseClient,
  enrollmentId: string
): Promise<{ start_date: string; days: HistoryDay[] } | null> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("id, started_at, program_id, programs(duration_days)")
    .eq("id", enrollmentId)
    .maybeSingle();

  if (enrollmentError || !enrollment?.started_at) return null;

  const program = enrollment.programs as unknown as { duration_days: number };
  const startDate = enrollment.started_at.slice(0, 10);

  function dayDate(start: string, dayNum: number): string {
    const d = new Date(start + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + dayNum - 1);
    return d.toISOString().slice(0, 10);
  }

  const [checkinsResult, templatesResult] = await Promise.all([
    supabase
      .from("daily_checkins")
      .select("day_number, mode, feeling")
      .eq("enrollment_id", enrollmentId),
    supabase
      .from("workout_templates")
      .select("day_number, workout_type")
      .eq("program_id", enrollment.program_id),
  ]);

  const checkinByDay = new Map(
    (checkinsResult.data ?? []).map((c) => [c.day_number, c])
  );
  const templateByDay = new Map(
    (templatesResult.data ?? []).map((t) => [t.day_number, t.workout_type as string])
  );

  const days: HistoryDay[] = Array.from(
    { length: program.duration_days },
    (_, i) => {
      const dayNumber = i + 1;
      const date = dayDate(startDate, dayNumber);
      const checkin = checkinByDay.get(dayNumber);
      const workoutType = templateByDay.get(dayNumber) ?? "main";

      let status: HistoryDayStatus;
      if (checkin) status = "completed";
      else if (date > today) status = "upcoming";
      else if (date === today) status = "today";
      else status = workoutType === "flexible" ? "rest_day" : "missed";

      return {
        day_number: dayNumber,
        date,
        status,
        mode: checkin?.mode ?? null,
        feeling: checkin?.feeling ?? null,
      };
    }
  );

  return { start_date: startDate, days };
}

export async function getCohortStats(
  supabase: SupabaseClient,
  cohortId: string
): Promise<{ completed_today: number; total_members: number } | null> {
  const { data, error } = await supabase.rpc("get_cohort_completion", {
    p_cohort_id: cohortId,
  });

  if (error) return null;
  const r = data as Record<string, unknown> | null;
  if (!r) return null;

  return {
    completed_today: typeof r.today_completed === "number" ? r.today_completed : 0,
    total_members: typeof r.total_members === "number" ? r.total_members : 0,
  };
}
