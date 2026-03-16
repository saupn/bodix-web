import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isValidReferralCode } from "@/lib/referral/utils";

/** GET ?code=LAN → { available: true | false } */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "Thiếu code." }, { status: 400 });
  }
  if (!isValidReferralCode(code)) {
    return NextResponse.json({ available: false, reason: "invalid_format" });
  }

  const service = createServiceClient();

  // Check profiles.referral_code
  const { data: profile } = await service
    .from("profiles")
    .select("id")
    .eq("referral_code", code)
    .maybeSingle();

  // Check referral_codes (affiliate codes, etc.)
  const { data: refCode } = await service
    .from("referral_codes")
    .select("id")
    .eq("code", code)
    .maybeSingle();

  const available = !profile && !refCode;

  return NextResponse.json({
    available,
    ...(available ? {} : { reason: "already_taken" }),
  });
}
