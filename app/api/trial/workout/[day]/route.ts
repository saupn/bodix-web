import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessTrialContent } from "@/lib/trial/utils";
import { isWithinTrialContentLimit } from "@/lib/trial/utils";
import { getTrialExperienceDay } from "@/lib/trial/calendar";

export async function GET(
  _request: Request,
  context: { params: Promise<{ day: string }> }
) {
  const { day: dayParam } = await context.params;
  const day = parseInt(dayParam, 10);

  if (![1, 2, 3].includes(day)) {
    return NextResponse.json({ error: "Ngày không hợp lệ." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("trial_ends_at, bodix_start_date")
    .eq("id", user.id)
    .single();

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, program_id, status")
    .eq("user_id", user.id)
    .eq("status", "trial")
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

  const trialExpDay = getTrialExperienceDay(profile?.bodix_start_date ?? null);
  if (trialExpDay === 0) {
    return NextResponse.json(
      { error: "Chương trình tập thử chưa bắt đầu. Vui lòng quay lại vào ngày bắt đầu." },
      { status: 403 }
    );
  }
  if (day > trialExpDay) {
    return NextResponse.json(
      { error: "Ngày này chưa mở khóa." },
      { status: 403 }
    );
  }

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
    .eq("user_id", user.id)
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
