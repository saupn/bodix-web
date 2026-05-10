import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("vouchers")
    .select(
      "id, code, amount, remaining_amount, status, expires_at, source_type, created_at, used_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[user/vouchers] query error:", error);
    return NextResponse.json({ error: "Lỗi truy vấn." }, { status: 500 });
  }

  const vouchers = data ?? [];
  const activeBalance = vouchers
    .filter((v) => v.status === "active" && new Date(v.expires_at) > new Date())
    .reduce((sum, v) => sum + (v.remaining_amount ?? 0), 0);

  return NextResponse.json({
    vouchers,
    active_balance: activeBalance,
  });
}
