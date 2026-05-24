import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/referral/commissions-summary
 * Trả về tổng quan commissions program_type='referral' của user hiện tại,
 * gom theo status. Dùng cho dashboard /referral hiển thị "Đang chờ / Đã thành
 * công / Đã huỷ" (BD-REFERRAL-VOUCHER-FLOW).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  // Service client vì commissions thường có RLS chỉ cho admin / beneficiary.
  // Filter beneficiary_user_id=user.id giữ scope đúng người.
  const service = createServiceClient();

  const { data, error } = await service
    .from("commissions")
    .select(
      "id, status, cancel_reason, reward_amount_vnd, beneficiary_code, referee_user_id, created_at, payable_at, cancelled_at",
    )
    .eq("program_type", "referral")
    .eq("beneficiary_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[referral/commissions-summary] query error:", error);
    return NextResponse.json({ error: "Lỗi truy vấn." }, { status: 500 });
  }

  const rows = data ?? [];

  const summary = {
    pending: 0,
    successful: 0, // payable + paid
    cancelled: 0,
    cancelled_by_reason: {} as Record<string, number>,
  };

  for (const r of rows) {
    if (r.status === "pending") summary.pending++;
    else if (r.status === "payable" || r.status === "paid") summary.successful++;
    else if (r.status === "cancelled" || r.status === "suspicious") {
      summary.cancelled++;
      const reason = r.cancel_reason ?? "unknown";
      summary.cancelled_by_reason[reason] =
        (summary.cancelled_by_reason[reason] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    summary,
    items: rows,
  });
}
