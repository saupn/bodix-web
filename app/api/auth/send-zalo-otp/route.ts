import { NextResponse, type NextRequest } from "next/server";
import { createHash, randomInt } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { sendOTP, formatPhoneVN } from "@/lib/messaging";

const OTP_TTL_MINUTES = 5;
const RATE_LIMIT_COUNT = 3;
const RATE_LIMIT_WINDOW_MINUTES = 10;

function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}

export async function POST(request: NextRequest) {
  let body: { phone?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.phone !== "string" || !body.phone.trim()) {
    return NextResponse.json(
      { error: "Thiếu số điện thoại." },
      { status: 400 }
    );
  }

  let formattedPhone: string;
  try {
    formattedPhone = formatPhoneVN(body.phone.trim());
  } catch {
    return NextResponse.json(
      { error: "Số điện thoại không hợp lệ." },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // Rate limit: max 3 OTP trong 10 phút
  const { count, error: countError } = await supabase
    .from("otp_verifications")
    .select("*", { count: "exact", head: true })
    .eq("phone", formattedPhone)
    .gte(
      "created_at",
      new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString()
    );

  if (countError) {
    console.error("[send-zalo-otp] rate limit check:", countError);
    return NextResponse.json(
      { error: "Lỗi hệ thống. Vui lòng thử lại." },
      { status: 500 }
    );
  }

  if ((count ?? 0) >= RATE_LIMIT_COUNT) {
    return NextResponse.json(
      { error: "Vui lòng đợi 10 phút trước khi gửi lại." },
      { status: 429 }
    );
  }

  const otpCode = randomInt(100000, 999999).toString();
  const otpHash = hashOtp(otpCode);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  const { error: insertError } = await supabase.from("otp_verifications").insert({
    phone: formattedPhone,
    otp_hash: otpHash,
    expires_at: expiresAt.toISOString(),
  });

  if (insertError) {
    console.error("[send-zalo-otp] insert:", insertError);
    return NextResponse.json(
      { error: "Lỗi hệ thống. Vui lòng thử lại." },
      { status: 500 }
    );
  }

  const result = await sendOTP({
    phone: formattedPhone,
    channel: "zalo",
    otpCode,
  });

  if (result.success) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    {
      error:
        "Số điện thoại này chưa đăng ký Zalo. Vui lòng dùng SĐT đã có Zalo.",
    },
    { status: 400 }
  );
}
