import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/** GET ?code=LAN → { name: "Nguyễn Thị Lan" } — dùng service role (RLS không cho anon đọc profiles người khác) */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ name: null });
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("full_name")
    .eq("referral_code", code)
    .maybeSingle();

  const name = profile?.full_name?.trim() || null;
  return NextResponse.json({ name });
}
