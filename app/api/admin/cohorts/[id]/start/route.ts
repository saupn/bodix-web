import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createServiceClient } from "@/lib/supabase/service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAdmin();
  if ("error" in auth) return auth.error;

  const { id: cohortId } = await params;
  if (!UUID_RE.test(cohortId)) {
    return NextResponse.json({ error: "cohort id không hợp lệ." }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: cohort } = await service
    .from("cohorts")
    .select("id, status, start_date")
    .eq("id", cohortId)
    .maybeSingle();

  if (!cohort) {
    return NextResponse.json({ error: "Cohort không tồn tại." }, { status: 404 });
  }
  if (cohort.status !== "upcoming") {
    return NextResponse.json(
      { error: `Chỉ bắt đầu được cohort 'upcoming' (hiện tại: ${cohort.status}).` },
      { status: 422 },
    );
  }

  // Cohort → active
  await service
    .from("cohorts")
    .update({ status: "active" })
    .eq("id", cohortId);

  // Lấy enrollments thuộc cohort (paid_waiting_cohort hoặc đã active sẵn)
  const { data: enrollments } = await service
    .from("enrollments")
    .select("id, user_id, status")
    .eq("cohort_id", cohortId)
    .in("status", ["paid_waiting_cohort", "active"]);

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({
      success: true,
      activated: 0,
      message: "Cohort active, nhưng không có enrollment nào.",
    });
  }

  // Active enrollments → current_day = 1
  const enrollmentIds = enrollments.map((e) => e.id);
  await service
    .from("enrollments")
    .update({
      status: "active",
      current_day: 1,
      started_at: cohort.start_date,
    })
    .in("id", enrollmentIds);

  // Update profiles
  const userIds = Array.from(new Set(enrollments.map((e) => e.user_id).filter(Boolean)));
  if (userIds.length > 0) {
    await service
      .from("profiles")
      .update({
        bodix_status: "active",
        bodix_current_day: 1,
        bodix_start_date: cohort.start_date,
      })
      .in("id", userIds);
  }

  // Cập nhật current_members
  await service
    .from("cohorts")
    .update({ current_members: enrollments.length })
    .eq("id", cohortId);

  return NextResponse.json({
    success: true,
    activated: enrollments.length,
    cohort_status: "active",
    start_date: cohort.start_date,
  });
}
