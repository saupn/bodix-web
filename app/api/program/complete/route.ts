import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  let body: { day?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const day = body.day;
  if (typeof day !== "number" || day < 1) {
    return NextResponse.json({ error: "Ngày không hợp lệ." }, { status: 400 });
  }

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, program_id, current_day")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!enrollment) {
    return NextResponse.json(
      { error: "Không có chương trình đang hoạt động." },
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
      { status: 400 }
    );
  }

  const newCurrentDay = Math.max(enrollment.current_day ?? 0, day + 1);

  const { error } = await supabase
    .from("enrollments")
    .update({
      current_day: newCurrentDay,
      updated_at: new Date().toISOString(),
    })
    .eq("id", enrollment.id);

  if (error) {
    console.error("[program/complete] update failed:", error);
    return NextResponse.json(
      { error: "Không thể cập nhật. Vui lòng thử lại." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    current_day: newCurrentDay,
  });
}
