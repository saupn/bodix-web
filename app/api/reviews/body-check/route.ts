import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  let body: {
    enrollment_id: string;
    week_number: number;
    shoulders: number;
    upper_back: number;
    lower_back: number;
    core_area: number;
    glutes: number;
    quads: number;
    hamstrings: number;
    calves: number;
    arms: number;
    notes?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { enrollment_id, week_number } = body;

  if (!enrollment_id || !week_number) {
    return NextResponse.json(
      { error: "Thiếu enrollment_id hoặc week_number." },
      { status: 400 }
    );
  }

  // Validate body area scores (1-3)
  const areaKeys = [
    "shoulders",
    "upper_back",
    "lower_back",
    "core_area",
    "glutes",
    "quads",
    "hamstrings",
    "calves",
    "arms",
  ] as const;

  for (const key of areaKeys) {
    const val = body[key];
    if (!Number.isInteger(val) || val < 1 || val > 3) {
      return NextResponse.json(
        { error: `${key} phải là số nguyên 1–3.` },
        { status: 400 }
      );
    }
  }

  // Verify enrollment ownership
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("id", enrollment_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!enrollment) {
    return NextResponse.json(
      { error: "Enrollment không tồn tại." },
      { status: 404 }
    );
  }

  // Upsert body_check
  const service = createServiceClient();
  const { data: bodyCheck, error: upsertError } = await service
    .from("body_checks")
    .upsert(
      {
        enrollment_id,
        week_number,
        shoulders: body.shoulders,
        upper_back: body.upper_back,
        lower_back: body.lower_back,
        core_area: body.core_area,
        glutes: body.glutes,
        quads: body.quads,
        hamstrings: body.hamstrings,
        calves: body.calves,
        arms: body.arms,
        notes: body.notes ?? null,
      },
      { onConflict: "enrollment_id,week_number" }
    )
    .select()
    .single();

  if (upsertError) {
    console.error("[reviews/body-check] POST upsert:", upsertError);
    return NextResponse.json(
      { error: "Không thể lưu body check." },
      { status: 500 }
    );
  }

  return NextResponse.json({ body_check: bodyCheck });
}
