import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createServiceClient } from "@/lib/supabase/service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
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

  const { data, error } = await service
    .from("enrollments")
    .select(
      `id, status, current_day, started_at, paid_at,
       profiles!user_id(id, full_name, phone, bodix_current_day)`,
    )
    .eq("cohort_id", cohortId)
    .order("started_at", { ascending: false });

  if (error) {
    console.error("[admin/cohorts/:id/users] fetch:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
