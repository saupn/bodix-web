import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createServiceClient } from "@/lib/supabase/service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tặng vé miễn phí cho 1 user (KOL / beta tester / người quen).
 * Tạo enrollment status='paid_waiting_cohort' với is_complimentary=true,
 * gán cohort_id luôn, và increment cohort.current_members.
 *
 * Body: { user_id: string, reason: string }
 * Hoặc:  { phone: string, reason: string }    (resolve user_id từ phone)
 */
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

  let body: { user_id?: unknown; phone?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const reason =
    typeof body.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim().slice(0, 500)
      : null;
  if (!reason) {
    return NextResponse.json(
      { error: "Vui lòng nhập lý do tặng vé." },
      { status: 400 },
    );
  }

  const service = createServiceClient();

  // ── Resolve user_id ──────────────────────────────────────────────────────
  let userId: string | null = null;
  if (typeof body.user_id === "string" && UUID_RE.test(body.user_id)) {
    userId = body.user_id;
  } else if (typeof body.phone === "string" && body.phone.trim().length > 0) {
    const phoneInput = body.phone.trim();
    // Match với phone hoặc zalo_phone (cả 2 format: 0909... và 84909...)
    const digits = phoneInput.replace(/\D/g, "");
    const candidates = [phoneInput, digits];
    if (digits.startsWith("0")) candidates.push(`84${digits.slice(1)}`);
    if (digits.startsWith("84")) candidates.push(`0${digits.slice(2)}`);

    const { data: profile } = await service
      .from("profiles")
      .select("id")
      .or(
        candidates.map((c) => `phone.eq.${c}`).join(",") +
          "," +
          candidates.map((c) => `zalo_phone.eq.${c}`).join(","),
      )
      .maybeSingle();

    userId = profile?.id ?? null;
  }

  if (!userId) {
    return NextResponse.json(
      { error: "Không tìm thấy user. Kiểm tra số điện thoại hoặc user_id." },
      { status: 404 },
    );
  }

  // ── Verify cohort + capacity ─────────────────────────────────────────────
  const { data: cohort } = await service
    .from("cohorts")
    .select("id, program_id, start_date, status, max_members, current_members")
    .eq("id", cohortId)
    .maybeSingle();

  if (!cohort) {
    return NextResponse.json({ error: "Cohort không tồn tại." }, { status: 404 });
  }
  if (cohort.status !== "upcoming") {
    return NextResponse.json(
      { error: "Chỉ tặng vé được cho cohort 'upcoming'." },
      { status: 422 },
    );
  }
  const max = cohort.max_members ?? 50;
  const current = cohort.current_members ?? 0;
  if (current >= max) {
    return NextResponse.json(
      { error: "Cohort đã đầy chỗ." },
      { status: 409 },
    );
  }

  // ── Check user chưa có enrollment cho program này ────────────────────────
  const { data: existing } = await service
    .from("enrollments")
    .select("id, status")
    .eq("user_id", userId)
    .eq("program_id", cohort.program_id)
    .in("status", [
      "trial",
      "trial_completed",
      "pending_payment",
      "paid_waiting_cohort",
      "active",
    ])
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        error: `User đã có enrollment cho chương trình này (status: ${existing.status}). Hủy enrollment cũ trước khi tặng vé.`,
      },
      { status: 409 },
    );
  }

  // ── Create complimentary enrollment ──────────────────────────────────────
  const { data: newEnrollment, error: createErr } = await service
    .from("enrollments")
    .insert({
      user_id: userId,
      program_id: cohort.program_id,
      cohort_id: cohortId,
      status: "paid_waiting_cohort",
      current_day: 0,
      paid_at: new Date().toISOString(),
      amount_paid: 0,
      payment_method: "complimentary",
      is_complimentary: true,
      complimentary_reason: reason,
      granted_by: auth.user.id,
      started_at: cohort.start_date,
    })
    .select("id")
    .single();

  if (createErr || !newEnrollment) {
    console.error("[grant-complimentary] insert:", createErr);
    return NextResponse.json(
      { error: "Không thể tạo enrollment." },
      { status: 500 },
    );
  }

  // ── Update cohort current_members + profile bodix_status ─────────────────
  await Promise.all([
    service
      .from("cohorts")
      .update({ current_members: current + 1 })
      .eq("id", cohortId),
    service
      .from("profiles")
      .update({
        bodix_status: "paid_waiting_cohort",
        bodix_start_date: cohort.start_date,
        bodix_program: null, // sẽ set bằng slug nếu cần — tạm null
      })
      .eq("id", userId),
  ]);

  return NextResponse.json({
    success: true,
    enrollment_id: newEnrollment.id,
    user_id: userId,
    cohort_id: cohortId,
  });
}
