import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeProgramDay } from "@/lib/program/day";

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

  const program = enrollment.program as unknown as {
    id: string;
    slug: string;
    name: string;
    duration_days: number;
    description: string | null;
  } | null;

  const cohort = enrollment.cohort as unknown as {
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

  // Không lấy cột exercises (JSON nặng) – các trang gọi route này chỉ cần
  // tiêu đề/thời lượng; chi tiết bài tập lấy ở /api/program/workout/[day].
  const { data: workouts } = await supabase
    .from("workout_templates")
    .select("id, day_number, title, duration_minutes, workout_type")
    .eq("program_id", program.id)
    .order("day_number", { ascending: true });

  const {
    programDay,
    cohortNotStarted,
    cohortActive,
    weekDays,
  } = computeProgramDay({
    currentDay: enrollment.current_day,
    durationDays: program.duration_days,
    cohortStartDate: cohort?.start_date ?? null,
    cohortEndDate: cohort?.end_date ?? null,
  });

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
