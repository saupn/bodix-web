import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { downloadGuideLeadSchema, safeParseBody } from "@/lib/validation/schemas";
import { isAffiliate } from "@/lib/affiliate/is-affiliate";
import {
  bookDownloadRateLimit,
  getClientIp,
  rateLimitExceeded,
} from "@/lib/middleware/rate-limit";

const STORAGE_BUCKET = "guides";
const STORAGE_PATH = "bodix-fuel-guide.pdf";
const FALLBACK_URL = "/guides/bodix-fuel-guide.pdf";
const SIGNED_URL_TTL_SECONDS = 3600;

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Chuẩn hoá SĐT VN về dạng lưu trữ 84XXXXXXXXX.
 * Chấp nhận: 0XXXXXXXXX (10 số, đầu 0) hoặc 84XXXXXXXXX / +84XXXXXXXXX.
 */
function formatPhoneStorage(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  // 0 + 9 số → thay 0 bằng 84
  if (digits.length === 10 && digits.startsWith("0")) {
    return `84${digits.slice(1)}`;
  }
  // 84 + 9 số (đã là dạng lưu trữ, có/không có dấu +)
  if (digits.length === 11 && digits.startsWith("84")) {
    return digits;
  }
  return null;
}

export async function POST(request: NextRequest) {
  // Chống bot spam form public (không login).
  const rl = bookDownloadRateLimit(getClientIp(request));
  if (!rl.ok) return rateLimitExceeded(rl.resetIn);

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

  // Affiliate tặng sách KHÔNG giới hạn → bỏ qua việc trừ quota gift_remaining.
  // Xác định affiliate qua referral_codes.is_affiliate của người tặng (profile.id).
  const gifterIsAffiliate = await isAffiliate(service, profile.id);
  if (!gifterIsAffiliate && remaining > 0) {
    const { error: updateError } = await service
      .from("profiles")
      .update({ gift_remaining: remaining - 1 })
      .eq("id", profile.id);

    if (updateError) {
      console.error("[download-guide] gift decrement:", updateError);
    }
  }

  // Generate signed URL from Supabase Storage; fallback to local /public path if storage unavailable.
  let downloadUrl = FALLBACK_URL;
  try {
    const { data: signed, error: signedError } = await service.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(STORAGE_PATH, SIGNED_URL_TTL_SECONDS);
    if (signedError) {
      console.warn("[download-guide] signed url failed, falling back:", signedError.message);
    } else if (signed?.signedUrl) {
      downloadUrl = signed.signedUrl;
    }
  } catch (err) {
    console.warn("[download-guide] storage error, falling back:", err);
  }

  return NextResponse.json({ success: true, downloadUrl });
}
