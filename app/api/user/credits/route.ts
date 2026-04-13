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
    .from("user_credits")
    .select("amount")
    .eq("user_id", user.id);

  if (error) {
    console.error("[user/credits] query error:", error);
    return NextResponse.json({ error: "Lỗi truy vấn." }, { status: 500 });
  }

  const balance = (data ?? []).reduce((sum, row) => sum + (row.amount ?? 0), 0);

  return NextResponse.json({ balance });
}
