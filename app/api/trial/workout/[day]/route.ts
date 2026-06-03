import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getWorkoutRequestUser } from "@/lib/workout-token";
import {
  canAccessTrialContent,
  isWithinTrialContentLimit,
  TRIAL_ACCESSIBLE_STATUSES,
} from "@/lib/trial/utils";
import { getCurrentTrialDay, resolveTrialStartDate } from "@/lib/trial/status";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ day: string }> }
) {
  const { day: dayParam } = await context.params;
  const day = parseInt(dayParam, 10);

  if (![1, 2, 3].includes(day)) {
    return NextResponse.json({ error: "Ngày không hợp lệ." }, { status: 400 });
  }

  // Chấp nhận session đầy đủ HOẶC cookie workout-token (magic link).
  const auth = await getWorkoutRequestUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  const supabase = createServiceClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("trial_ends_at, bodix_start_date, trial_started_at")
    .eq("id", auth.userId)
    .single();

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, program_id, status, started_at, enrolled_at")
    .eq("user_id", auth.userId)
    .in("status", Array.from(TRIAL_ACCESSIBLE_STATUSES))
    .order("enrolled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    !enrollment ||
    !canAccessTrialContent({
      status: enrollment.status,
      trial_ends_at: profile?.trial_ends_at ?? null,
    })
  ) {
    return NextResponse.json(
      { error: "Bạn không có quyền xem nội dung trial." },
      { status: 403 }
    );
  }

  if (!isWithinTrialContentLimit(day)) {
    return NextResponse.json(
      { error: "Ngày không nằm trong phạm vi trial." },
      { status: 403 }
    );
  }

  // Sequential gating: chặn truy cập trực tiếp workout của ngày CHƯA tới.
  // trialDayToday tính từ bodix_start_date theo lịch VN (KHÔNG dùng current_day).
  // 0 = chưa bắt đầu → khoá tất cả; >3 = đã hết trial → mở hết để xem lại.
  const trialStartDate = resolveTrialStartDate({
    bodix_start_date: profile?.bodix_start_date ?? null,
    started_at: enrollment.started_at,
    trial_started_at: profile?.trial_started_at ?? null,
    enrolled_at: enrollment.enrolled_at,
  });
  const trialDayToday = getCurrentTrialDay(trialStartDate);
  if (day > trialDayToday) {
    return NextResponse.json(
      {
        error: "Phiên tập này chưa mở. Quay lại vào đúng ngày nhé!",
        locked: true,
      },
      { status: 403 }
    );
  }

  // Nội dung trial là content cố định (độc lập cohort/current_day) — đã qua các
  // gate ở trên (quyền truy cập + ngày đã mở) thì load bài tập của ngày đó.
  const { data: workout, error } = await supabase
    .from("workout_templates")
    .select(
      "id, day_number, title, description, duration_minutes, workout_type, hard_version, light_version, recovery_version"
    )
    .eq("program_id", enrollment.program_id)
    .eq("day_number", day)
    .single();

  if (error || !workout) {
    return NextResponse.json(
      { error: "Không tìm thấy bài tập." },
      { status: 404 }
    );
  }

  const { data: completedActivities } = await supabase
    .from("trial_activities")
    .select("id, metadata")
    .eq("user_id", auth.userId)
    .eq("program_id", enrollment.program_id)
    .eq("activity_type", "complete_trial_day")
    .limit(20);

  const isCompleted =
    (completedActivities ?? []).some(
      (a) => (a.metadata as { day_number?: number })?.day_number === day
    ) ?? false;

  return NextResponse.json({
    workout,
    program_id: enrollment.program_id,
    is_completed: isCompleted,
  });
}
