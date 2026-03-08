import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Add days to date string YYYY-MM-DD */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const { data: enrollment, error: enrollError } = await supabase
    .from("enrollments")
    .select("id, current_day, started_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (enrollError || !enrollment) {
    return NextResponse.json({
      hasEnrollment: false,
      pending: false,
      reason: "no_active_enrollment",
    });
  }

  const currentDay = enrollment.current_day ?? 0;
  const completedWeeks = Math.floor(currentDay / 7);

  if (completedWeeks < 1) {
    return NextResponse.json({
      hasEnrollment: true,
      pending: false,
      reason: "first_week_not_complete",
      week_number: 0,
    });
  }

  const weekNumber = completedWeeks;
  const weekStartDay = (weekNumber - 1) * 7 + 1;
  const weekEndDay = weekNumber * 7;

  const startedAt = enrollment.started_at as string | null;
  const startDate = startedAt ? startedAt.slice(0, 10) : null;
  const weekStartDate = startDate ? addDays(startDate, weekStartDay - 1) : null;
  const weekEndDate = startDate ? addDays(startDate, weekEndDay - 1) : null;

  const { data: existingReview } = await supabase
    .from("weekly_reviews")
    .select("*")
    .eq("enrollment_id", enrollment.id)
    .eq("week_number", weekNumber)
    .maybeSingle();

  const ictNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const ictDay = ictNow.getUTCDay();
  const isReviewWindow = ictDay === 0 || ictDay === 1;

  if (existingReview) {
    return NextResponse.json({
      hasEnrollment: true,
      enrollment_id: enrollment.id,
      week_number: weekNumber,
      start_date: weekStartDate,
      end_date: weekEndDate,
      pending: false,
      reason: "already_submitted",
      existing_review: existingReview,
      is_review_window: isReviewWindow,
    });
  }

  const { data: checkins } = await supabase
    .from("daily_checkins")
    .select("day_number, mode, feeling")
    .eq("enrollment_id", enrollment.id)
    .gte("day_number", weekStartDay)
    .lte("day_number", weekEndDay);

  const weekCheckins = checkins ?? [];
  const completedCount = weekCheckins.filter((c) => c.mode !== "skip").length;
  const rate = Math.round((completedCount / 7) * 100);
  const hardCount = weekCheckins.filter((c) => c.mode === "hard").length;
  const lightCount = weekCheckins.filter((c) => c.mode === "light").length;
  const recoveryCount = weekCheckins.filter((c) => c.mode === "recovery").length;
  const feelingsRaw = weekCheckins
    .map((c) => c.feeling)
    .filter((f): f is number => f !== null);
  const avgFeeling =
    feelingsRaw.length > 0
      ? feelingsRaw.reduce((a, b) => a + b, 0) / feelingsRaw.length
      : null;

  const dayCompleted = Array.from({ length: 7 }, (_, i) => {
    const dayNum = weekStartDay + i;
    const c = weekCheckins.find((x) => x.day_number === dayNum);
    return c ? c.mode !== "skip" : false;
  });

  return NextResponse.json({
    hasEnrollment: true,
    enrollment_id: enrollment.id,
    week_number: weekNumber,
    start_date: weekStartDate,
    end_date: weekEndDate,
    pending: true,
    is_review_window: isReviewWindow,
    week_stats: {
      completed_count: completedCount,
      completion_rate: rate,
      hard_count: hardCount,
      light_count: lightCount,
      recovery_count: recoveryCount,
      avg_feeling: avgFeeling,
      day_completed: dayCompleted,
    },
  });
}
