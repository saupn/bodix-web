import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const DOWNLOAD_URL = "/guides/bodix-fuel-guide.pdf";

export async function POST(request: NextRequest) {
  let body: { email?: string; name?: string; referral_code?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON." },
      { status: 400 }
    );
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      { error: "Vui lòng nhập email." },
      { status: 400 }
    );
  }

  const name = body.name?.trim() || null;
  const referralCode = body.referral_code?.trim().toUpperCase() || null;
  const source = referralCode ? "gift_page" : "homepage";

  const service = createServiceClient();

  await service.from("leads").insert({
    email,
    name,
    source,
    referral_code: referralCode,
    downloaded: true,
  });

  if (referralCode) {
    const { data: profile } = await service
      .from("profiles")
      .select("id, gift_remaining")
      .eq("referral_code", referralCode)
      .gt("gift_remaining", 0)
      .maybeSingle();

    if (profile) {
      const newRemaining = Math.max(0, (profile.gift_remaining ?? 10) - 1);
      await service
        .from("profiles")
        .update({ gift_remaining: newRemaining })
        .eq("id", profile.id);
    }
  }

  return NextResponse.json({ downloadUrl: DOWNLOAD_URL });
}
