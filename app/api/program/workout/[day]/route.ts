import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ day: string }> }
) {
  const { day: dayParam } = await context.params;
  const day = parseInt(dayParam, 10);

  if (!Number.isInteger(day) || day < 1) {
    return NextResponse.json({ error: "Ngày không hợp lệ." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, program_id, status, started_at")
    .eq("user_id", user.id)
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
      "id, day_number, week_number, title, description, duration_minutes, workout_type, hard_version, light_version, recovery_version"
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
