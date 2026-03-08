import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessTrialContent } from "@/lib/trial/utils";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("trial_ends_at")
    .eq("id", user.id)
    .single();

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, program_id, status")
    .eq("user_id", user.id)
    .eq("status", "trial")
    .limit(1)
    .maybeSingle();

  if (!enrollment || !canAccessTrialContent({
    status: enrollment.status,
    trial_ends_at: profile?.trial_ends_at ?? null,
  })) {
    return NextResponse.json(
      { error: "Bạn không có quyền xem nội dung trial." },
      { status: 403 }
    );
  }

  const { data: workouts, error } = await supabase
    .from("workout_templates")
    .select("id, day_number, title, description, duration_minutes, workout_type")
    .eq("program_id", enrollment.program_id)
    .in("day_number", [1, 2, 3])
    .order("day_number", { ascending: true });

  if (error) {
    console.error("[trial/workouts] fetch failed:", error);
    return NextResponse.json(
      { error: "Không thể tải bài tập." },
      { status: 500 }
    );
  }

  return NextResponse.json({ workouts: workouts ?? [] });
}
