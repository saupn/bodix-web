import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createServiceClient } from "@/lib/supabase/service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if ("error" in auth) return auth.error;

  let body: { name?: unknown; start_date?: unknown; program_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const startDateStr = typeof body.start_date === "string" ? body.start_date : "";
  const programId = typeof body.program_id === "string" ? body.program_id : "";

  if (!name || !startDateStr || !programId) {
    return NextResponse.json(
      { error: "Thiếu name, start_date hoặc program_id." },
      { status: 400 },
    );
  }
  if (!UUID_RE.test(programId)) {
    return NextResponse.json({ error: "program_id không hợp lệ." }, { status: 400 });
  }

  const startDate = new Date(startDateStr);
  if (Number.isNaN(startDate.getTime())) {
    return NextResponse.json({ error: "start_date không hợp lệ." }, { status: 400 });
  }
  const minDate = new Date();
  minDate.setHours(0, 0, 0, 0);
  minDate.setDate(minDate.getDate() + 3);
  if (startDate < minDate) {
    return NextResponse.json(
      { error: "Ngày bắt đầu phải sau ít nhất 3 ngày." },
      { status: 400 },
    );
  }

  const service = createServiceClient();

  const { data: program } = await service
    .from("programs")
    .select("id, duration_days")
    .eq("id", programId)
    .maybeSingle();

  if (!program) {
    return NextResponse.json({ error: "Chương trình không tồn tại." }, { status: 404 });
  }

  // Tính end_date
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + (program.duration_days ?? 21) - 1);

  const { data, error } = await service
    .from("cohorts")
    .insert({
      name,
      start_date: startDateStr,
      end_date: endDate.toISOString().split("T")[0],
      program_id: programId,
      status: "upcoming",
      current_members: 0,
    })
    .select()
    .single();

  if (error) {
    console.error("[admin/cohorts] insert:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
