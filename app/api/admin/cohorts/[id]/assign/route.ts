import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createServiceClient } from "@/lib/supabase/service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAdmin();
  if ("error" in auth) return auth.error;

  const { id: cohortId } = await params;
  if (!UUID_RE.test(cohortId)) {
    return NextResponse.json({ error: "cohort id không hợp lệ." }, { status: 400 });
  }

  let body: { user_ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!Array.isArray(body.user_ids) || body.user_ids.length === 0) {
    return NextResponse.json(
      { error: "user_ids phải là array không rỗng." },
      { status: 400 },
    );
  }
  const userIds = body.user_ids.filter(
    (v): v is string => typeof v === "string" && UUID_RE.test(v),
  );
  if (userIds.length === 0) {
    return NextResponse.json({ error: "user_ids không hợp lệ." }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: cohort } = await service
    .from("cohorts")
    .select("id, program_id, start_date, status, current_members")
    .eq("id", cohortId)
    .maybeSingle();

  if (!cohort) {
    return NextResponse.json({ error: "Cohort không tồn tại." }, { status: 404 });
  }
  if (cohort.status !== "upcoming") {
    return NextResponse.json(
      { error: "Chỉ có thể gán users vào cohort 'upcoming'." },
      { status: 422 },
    );
  }

  const results: { user_id: string; success: boolean; error?: string }[] = [];

  for (const userId of userIds) {
    // Tìm enrollment paid_waiting_cohort cho user + program
    const { data: enrollment } = await service
      .from("enrollments")
      .select("id, status, cohort_id")
      .eq("user_id", userId)
      .eq("program_id", cohort.program_id)
      .in("status", ["paid_waiting_cohort", "pending_payment"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (enrollment) {
      const { error: updErr } = await service
        .from("enrollments")
        .update({
          cohort_id: cohortId,
          started_at: cohort.start_date,
        })
        .eq("id", enrollment.id);

      if (updErr) {
        results.push({ user_id: userId, success: false, error: updErr.message });
        continue;
      }
    } else {
      // Không có enrollment phù hợp → tạo mới (admin có thể đã chuyển từ flow khác)
      const { error: insErr } = await service.from("enrollments").insert({
        user_id: userId,
        program_id: cohort.program_id,
        cohort_id: cohortId,
        status: "paid_waiting_cohort",
        current_day: 0,
        started_at: cohort.start_date,
      });

      if (insErr) {
        results.push({ user_id: userId, success: false, error: insErr.message });
        continue;
      }
    }

    // Update profile: gắn cohort context
    await service
      .from("profiles")
      .update({
        bodix_status: "paid_waiting_cohort",
        bodix_start_date: cohort.start_date,
      })
      .eq("id", userId);

    results.push({ user_id: userId, success: true });
  }

  // Cập nhật current_members
  const { count } = await service
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("cohort_id", cohortId);

  if (typeof count === "number") {
    await service
      .from("cohorts")
      .update({ current_members: count })
      .eq("id", cohortId);
  }

  const successCount = results.filter((r) => r.success).length;
  return NextResponse.json({
    success: successCount > 0,
    assigned: successCount,
    total: userIds.length,
    results,
  });
}
