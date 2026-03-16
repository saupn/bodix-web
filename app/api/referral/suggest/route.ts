import { NextRequest, NextResponse } from "next/server";
import { suggestReferralCodes } from "@/lib/referral/utils";

/** GET ?name=Nguyễn Thị Lan → { suggestions: ['LAN', 'NGUYENLAN', ...] } */
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name")?.trim() ?? "";
  const suggestions = suggestReferralCodes(name);
  return NextResponse.json({ suggestions });
}
