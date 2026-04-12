import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { downloadGuideLeadSchema, safeParseBody } from "@/lib/validation/schemas";

const DOWNLOAD_URL = "/guides/bodix-fuel-guide.pdf";

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidVnPhone10(digits: string): boolean {
  return digits.length === 10 && digits.startsWith("0");
}

/** 0909123456 → 84909123456 */
function formatPhoneStorage(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!isValidVnPhone10(digits)) return null;
  return `84${digits.slice(1)}`;
}

export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = safeParseBody(downloadGuideLeadSchema, json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { phone: phoneRaw, name: nameRaw, referral_code: referralCode } = parsed.data;
  const formattedPhone = formatPhoneStorage(phoneRaw);
  if (!formattedPhone) {
    return NextResponse.json(
      { error: "Số điện thoại không hợp lệ (cần 10 số, bắt đầu bằng 0)." },
      { status: 400 },
    );
  }

  const name = nameRaw?.trim() ? stripHtml(nameRaw).slice(0, 200) || null : null;

  const service = createServiceClient();

  const { data: profile } = await service
    .from("profiles")
    .select("id, gift_remaining")
    .eq("referral_code", referralCode)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Link tặng không hợp lệ." }, { status: 400 });
  }

  const remaining = profile.gift_remaining ?? 10;

  const { error: insertError } = await service.from("leads").insert({
    phone: formattedPhone,
    email: null,
    name,
    source: "gift",
    referral_code: referralCode,
    downloaded: true,
  });

  if (insertError) {
    console.error("[download-guide] insert:", insertError);
    return NextResponse.json({ error: "Không thể lưu thông tin. Vui lòng thử lại." }, { status: 500 });
  }

  if (remaining > 0) {
    const { error: updateError } = await service
      .from("profiles")
      .update({ gift_remaining: remaining - 1 })
      .eq("id", profile.id);

    if (updateError) {
      console.error("[download-guide] gift decrement:", updateError);
    }
  }

  return NextResponse.json({ success: true, downloadUrl: DOWNLOAD_URL });
}
