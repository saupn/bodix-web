import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  isValidReferralCode,
  sanitizeReferralCodeInput,
} from "@/lib/referral/utils";
import { REFERRAL_REWARD_AMOUNT, REFERRAL_DISCOUNT_PERCENT } from "@/lib/affiliate/config";

/** POST { code: "LAN" } — Đặt mã giới thiệu cá nhân (onboarding hoặc profile) */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const rawCode = sanitizeReferralCodeInput(body.code ?? "");
  if (!rawCode) {
    return NextResponse.json(
      { error: "Mã phải từ 3–15 ký tự, chỉ dùng chữ in hoa, số và dấu chấm." },
      { status: 400 }
    );
  }
  if (!isValidReferralCode(rawCode)) {
    return NextResponse.json(
      { error: "Mã không hợp lệ. Dùng A-Z, 0-9, dấu chấm, 3–15 ký tự." },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  // Check availability (exclude current user's existing code)
  const { data: existingProfile } = await service
    .from("profiles")
    .select("id, referral_code")
    .eq("id", user.id)
    .single();

  const isOwnCode = existingProfile?.referral_code === rawCode;
  if (!isOwnCode) {
    const { data: takenByProfile } = await service
      .from("profiles")
      .select("id")
      .eq("referral_code", rawCode)
      .maybeSingle();
    const { data: takenByRefCode } = await service
      .from("referral_codes")
      .select("id")
      .eq("code", rawCode)
      .maybeSingle();

    if (takenByProfile || takenByRefCode) {
      return NextResponse.json(
        { error: "Mã này đã được sử dụng. Vui lòng chọn mã khác." },
        { status: 409 }
      );
    }
  }

  // 1. Update profiles.referral_code
  const { error: updateError } = await service
    .from("profiles")
    .update({ referral_code: rawCode })
    .eq("id", user.id);

  if (updateError) {
    console.error("[referral/set] profile update:", updateError);
    return NextResponse.json(
      { error: "Không thể cập nhật mã." },
      { status: 500 }
    );
  }

  // 2. Upsert referral_codes (để r/[code] và checkout hoạt động)
  const { data: existingRefCode } = await service
    .from("referral_codes")
    .select("id, code")
    .eq("user_id", user.id)
    .eq("code_type", "referral")
    .maybeSingle();

  if (existingRefCode) {
    if (existingRefCode.code !== rawCode) {
      await service
        .from("referral_codes")
        .update({ code: rawCode, updated_at: new Date().toISOString() })
        .eq("id", existingRefCode.id);
    }
  } else {
    const { error: insertError } = await service.from("referral_codes").insert({
      user_id: user.id,
      code: rawCode,
      code_type: "referral",
      reward_type: "credit",
      reward_value: REFERRAL_REWARD_AMOUNT,
      referee_reward_type: "discount_percent",
      referee_reward_value: REFERRAL_DISCOUNT_PERCENT,
    });

    if (insertError) {
      console.error("[referral/set] referral_codes insert:", insertError);
      // Non-fatal: profile đã update, referral_codes có thể bị conflict
    }
  }

  const base =
    process.env.NEXT_PUBLIC_APP_URL || "https://bodix.fit";
  const referralLink = `${base}/r/${rawCode}`;

  return NextResponse.json({
    success: true,
    code: rawCode,
    referral_link: referralLink,
  });
}
