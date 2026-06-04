import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getWorkoutRequestUser } from "@/lib/workout-token";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ day: string }> }
) {
  const { day: dayParam } = await context.params;
  const day = parseInt(dayParam, 10);

  if (!Number.isInteger(day) || day < 1) {
    return NextResponse.json({ error: "Ngày không hợp lệ." }, { status: 400 });
  }

  // Chấp nhận session đầy đủ HOẶC cookie workout-token (magic link).
  const auth = await getWorkoutRequestUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  // Service client (filter user_id thủ công) — token-only không có RLS session.
  const supabase = createServiceClient();

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, program_id, status, started_at")
    .eq("user_id", auth.userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!enrollment) {
    return NextResponse.json(
      { error: "Bạn không có chương trình đang hoạt động." },
      { status: 403 }
    );
  }

  const { data: program } = await supabase
    .from("programs")
    .select("duration_days")
    .eq("id", enrollment.program_id)
    .single();

  if (!program || day > program.duration_days) {
    return NextResponse.json(
      { error: "Ngày không nằm trong phạm vi chương trình." },
      { status: 404 }
    );
  }

  const { data: workout, error } = await supabase
    .from("workout_templates")
    .select(
      "id, day_number, week_number, title, description, duration_minutes, workout_type, exercises"
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

  const { data: checkin } = await supabase
    .from("daily_checkins")
    .select("mode, feeling")
    .eq("enrollment_id", enrollment.id)
    .eq("day_number", day)
    .maybeSingle();

  const isCompleted = !!checkin;

  return NextResponse.json({
    workout,
    program_id: enrollment.program_id,
    enrollment_id: enrollment.id,
    is_completed: isCompleted,
    checkin: checkin
      ? {
          mode: checkin.mode,
          feeling: checkin.feeling,
        }
      : null,
  });
}
