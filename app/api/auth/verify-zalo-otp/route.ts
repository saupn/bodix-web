import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { formatPhoneVN } from "@/lib/messaging";

function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}

export async function POST(request: NextRequest) {
  let body: { phone?: unknown; otp?: unknown };
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

  if (typeof body.otp !== "string" || !body.otp.trim()) {
    return NextResponse.json({ error: "Thiếu mã OTP." }, { status: 400 });
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

  const otpInput = body.otp.trim();
  const otpHash = hashOtp(otpInput);

  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Vui lòng đăng nhập để xác minh OTP." },
      { status: 401 }
    );
  }

  const service = createServiceClient();

  const { data: row, error: selectError } = await service
    .from("otp_verifications")
    .select("id, otp_hash, attempts")
    .eq("phone", formattedPhone)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (selectError || !row) {
    return NextResponse.json(
      { error: "Mã đã hết hạn. Vui lòng gửi mã mới." },
      { status: 400 }
    );
  }

  if ((row.attempts ?? 0) >= 5) {
    return NextResponse.json(
      { error: "Quá nhiều lần thử. Vui lòng gửi mã mới." },
      { status: 400 }
    );
  }

  if (row.otp_hash !== otpHash) {
    await service
      .from("otp_verifications")
      .update({ attempts: (row.attempts ?? 0) + 1 })
      .eq("id", row.id);

    return NextResponse.json(
      { error: "Mã không đúng." },
      { status: 400 }
    );
  }

  await service
    .from("otp_verifications")
    .update({ used: true })
    .eq("id", row.id);

  await service
    .from("profiles")
    .update({
      phone: formattedPhone,
      phone_verified: true,
      zalo_phone: formattedPhone,
      zalo_verified: true,
      preferred_channel: "zalo",
      channel_user_id: null,
    })
    .eq("id", user.id);

  return NextResponse.json({ success: true });
}
