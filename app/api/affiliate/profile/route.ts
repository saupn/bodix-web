import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  let body: {
    bank_name?: string;
    bank_account_number?: string;
    bank_account_name?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { data: affiliate, error: fetchError } = await supabase
    .from("affiliate_profiles")
    .select("id, is_approved")
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError || !affiliate) {
    return NextResponse.json({ error: "Bạn chưa đăng ký affiliate." }, { status: 404 });
  }

  if (!affiliate.is_approved) {
    return NextResponse.json({ error: "Tài khoản affiliate chưa được duyệt." }, { status: 403 });
  }

  const updates: Record<string, string | null> = {};
  if (body.bank_name !== undefined) updates.bank_name = body.bank_name?.trim() || null;
  if (body.bank_account_number !== undefined)
    updates.bank_account_number = body.bank_account_number?.trim() || null;
  if (body.bank_account_name !== undefined)
    updates.bank_account_name = body.bank_account_name?.trim() || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "Không có thay đổi." });
  }

  updates.updated_at = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("affiliate_profiles")
    .update(updates)
    .eq("id", affiliate.id);

  if (updateError) {
    console.error("[affiliate/profile] PATCH:", updateError);
    return NextResponse.json({ error: "Không thể cập nhật." }, { status: 500 });
  }

  return NextResponse.json({ message: "Đã cập nhật." });
}
