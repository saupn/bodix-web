import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const { data: enrollment, error: enrollError } = await supabase
    .from("enrollments")
    .select(
      `
      id,
      program_id,
      cohort_id,
      status,
      current_day,
      started_at,
      program:programs (
        id,
        slug,
        name,
        duration_days,
        description
      ),
      cohort:cohorts (
        id,
        name,
        start_date,
        end_date,
        status
      )
    `
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("enrolled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (enrollError || !enrollment) {
    return NextResponse.json(
      { error: "Không có chương trình đang hoạt động." },
      { status: 404 }
    );
  }

  const program = enrollment.program as {
    id: string;
    slug: string;
    name: string;
    duration_days: number;
    description: string | null;
  } | null;

  const cohort = enrollment.cohort as {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    status: string;
  } | null;

  if (!program) {
    return NextResponse.json(
      { error: "Chương trình không tồn tại." },
      { status: 404 }
    );
  }

  const { data: workouts } = await supabase
    .from("workout_templates")
    .select("id, day_number, title, duration_minutes, workout_type, hard_version, light_version, recovery_version")
    .eq("program_id", program.id)
    .order("day_number", { ascending: true });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = cohort?.start_date
    ? new Date(cohort.start_date)
    : null;
  const endDate = cohort?.end_date ? new Date(cohort.end_date) : null;

  let programDay = enrollment.current_day ?? 0;
  if (startDate && cohort) {
    const start = new Date(cohort.start_date);
    start.setHours(0, 0, 0, 0);
    const diff = Math.floor(
      (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    const computedDay = Math.min(
      Math.max(1, diff + 1),
      program.duration_days
    );
    if (diff >= 0) {
      programDay = Math.max(enrollment.current_day ?? 0, computedDay);
    }
  }

  const cohortNotStarted =
    startDate && today < startDate;
  let cohortActive =
    startDate &&
    endDate &&
    today >= startDate &&
    today <= endDate;

  if (!cohortNotStarted && !cohortActive && programDay > 0) {
    cohortActive = true;
  }

  const weekSize = 7;
  const currentWeek = programDay > 0 ? Math.ceil(programDay / weekSize) : 1;
  const weekStartDay = (currentWeek - 1) * weekSize + 1;
  const weekDays = Array.from(
    { length: Math.min(weekSize, program.duration_days - weekStartDay + 1) },
    (_, i) => weekStartDay + i
  ).filter((d) => d >= 1 && d <= program.duration_days);

  const todayWorkout = (workouts ?? []).find((w) => w.day_number === programDay);

  return NextResponse.json({
    enrollment: {
      id: enrollment.id,
      program_id: enrollment.program_id,
      cohort_id: enrollment.cohort_id,
      current_day: programDay,
      started_at: enrollment.started_at,
    },
    program,
    cohort,
    workouts: workouts ?? [],
    program_day: programDay,
    total_days: program.duration_days,
    cohort_not_started: cohortNotStarted,
    cohort_active: cohortActive,
    today_workout: todayWorkout ?? null,
    week_days: weekDays,
    completed_days: [],
    today_completed: false,
    today_completed_mode: null,
  });
}
