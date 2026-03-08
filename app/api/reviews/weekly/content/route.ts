import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const programId = request.nextUrl.searchParams.get("program_id");
  const weekNumber = request.nextUrl.searchParams.get("week_number");

  if (!programId || !weekNumber) {
    return NextResponse.json(
      { error: "Thiếu program_id hoặc week_number." },
      { status: 400 }
    );
  }

  const weekNum = Number(weekNumber);
  if (!Number.isInteger(weekNum) || weekNum < 1) {
    return NextResponse.json(
      { error: "week_number không hợp lệ." },
      { status: 400 }
    );
  }

  const { data: content, error } = await supabase
    .from("review_content")
    .select(
      "review_video_url, review_video_title, review_video_duration, coach_note, next_week_focus"
    )
    .eq("program_id", programId)
    .eq("week_number", weekNum)
    .maybeSingle();

  if (error) {
    console.error("[reviews/weekly/content] GET:", error);
    return NextResponse.json({ error: "Lỗi truy vấn." }, { status: 500 });
  }

  return NextResponse.json({ content: content ?? null });
}
