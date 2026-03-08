import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("affiliate_profiles")
    .select("id, affiliate_tier, is_approved, bank_name, bank_account_number, bank_account_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[affiliate/status] profile:", profileError);
    return NextResponse.json({ error: "Lỗi truy vấn." }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({
      has_profile: false,
      is_approved: false,
    });
  }

  return NextResponse.json({
    has_profile: true,
    is_approved: !!profile.is_approved,
    tier: profile.affiliate_tier,
    has_bank_info: !!(profile.bank_account_number?.trim()),
  });
}
