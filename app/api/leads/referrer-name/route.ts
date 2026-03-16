import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** GET ?code=LAN → { name: "Nguyễn Thị Lan" } */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ name: null });
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("referral_code", code)
    .maybeSingle();

  const name = profile?.full_name?.trim() || null;
  return NextResponse.json({ name });
}
