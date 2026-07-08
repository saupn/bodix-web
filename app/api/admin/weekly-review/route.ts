import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createServiceClient } from "@/lib/supabase/service";

// Nội dung Q&A + video cho tin Review Chủ nhật (bảng weekly_review_content).
// Key: (cohort_id, week_start_date = thứ 2 đầu tuần theo lịch VN).

const YMD = /^\d{4}-\d{2}-\d{2}$/;

// GET ?cohort_id=&week_start_date= → row hiện có (hoặc null)
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin();
  if ("error" in admin) return admin.error;

  const cohortId = request.nextUrl.searchParams.get("cohort_id");
  const weekStart = request.nextUrl.searchParams.get("week_start_date");

  if (!cohortId || !weekStart || !YMD.test(weekStart)) {
    return NextResponse.json(
      { error: "Thiếu hoặc sai cohort_id / week_start_date (YYYY-MM-DD)." },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("weekly_review_content")
    .select("id, cohort_id, week_start_date, qa_content, video_url, updated_at")
    .eq("cohort_id", cohortId)
    .eq("week_start_date", weekStart)
    .maybeSingle();

  if (error) {
    console.error("[admin/weekly-review] GET:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ content: data ?? null });
}

// POST { cohort_id, week_start_date, qa_content?, video_url? } → upsert
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if ("error" in admin) return admin.error;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body không hợp lệ." }, { status: 400 });
  }

  const { cohort_id, week_start_date, qa_content, video_url } = body;

  if (!cohort_id || !week_start_date || !YMD.test(String(week_start_date))) {
    return NextResponse.json(
      { error: "Thiếu hoặc sai cohort_id / week_start_date (YYYY-MM-DD)." },
      { status: 400 }
    );
  }

  const qa = typeof qa_content === "string" && qa_content.trim() ? qa_content.trim() : null;
  const video = typeof video_url === "string" && video_url.trim() ? video_url.trim() : null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("weekly_review_content")
    .upsert(
      {
        cohort_id,
        week_start_date,
        qa_content: qa,
        video_url: video,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cohort_id,week_start_date" }
    )
    .select()
    .single();

  if (error) {
    console.error("[admin/weekly-review] POST:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, content: data });
}
