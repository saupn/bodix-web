import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createServiceClient } from "@/lib/supabase/service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_STATUSES = new Set(["upcoming", "active", "completed"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "id không hợp lệ." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    updates.name = body.name.trim();
  }
  if (typeof body.start_date === "string" && body.start_date) {
    updates.start_date = body.start_date;
  }
  if (typeof body.status === "string" && ALLOWED_STATUSES.has(body.status)) {
    updates.status = body.status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Không có gì để cập nhật." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("cohorts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[admin/cohorts/:id] patch:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "id không hợp lệ." }, { status: 400 });
  }

  const service = createServiceClient();

  // Chỉ cho xóa khi chưa có enrollments
  const { data: enrollments } = await service
    .from("enrollments")
    .select("id")
    .eq("cohort_id", id)
    .limit(1);

  if (enrollments && enrollments.length > 0) {
    return NextResponse.json(
      { error: "Cohort đã có users — không thể xóa." },
      { status: 400 },
    );
  }

  const { error } = await service.from("cohorts").delete().eq("id", id);
  if (error) {
    console.error("[admin/cohorts/:id] delete:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
