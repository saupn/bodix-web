import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  resolveReferralReward,
  resolveVoucherReward,
  NO_REWARD,
  type ResolvedReward,
} from "@/lib/checkout/resolve-reward";

type CodeType = "referral" | "affiliate" | "voucher" | null;

interface ValidateResponse {
  valid: boolean;
  code_type: CodeType;
  reward: ResolvedReward;
  referrer_name?: string;
  error?: string;
  reason?: string;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json<ValidateResponse>(
      { valid: false, code_type: null, reward: NO_REWARD, error: "Thiếu code." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const service = createServiceClient();

  // ── Try referral_codes first ─────────────────────────────────────────────
  const { data: referralCode } = await service
    .from("referral_codes")
    .select(
      "id, user_id, code, code_type, referee_reward_type, referee_reward_value, is_active, max_uses, total_conversions, expires_at",
    )
    .eq("code", code)
    .maybeSingle();

  if (referralCode) {
    if (!referralCode.is_active) {
      return NextResponse.json<ValidateResponse>({
        valid: false,
        code_type: referralCode.code_type ?? "referral",
        reward: NO_REWARD,
        reason: "code_inactive",
      });
    }
    if (referralCode.expires_at && new Date(referralCode.expires_at) < new Date()) {
      return NextResponse.json<ValidateResponse>({
        valid: false,
        code_type: referralCode.code_type ?? "referral",
        reward: NO_REWARD,
        reason: "code_expired",
      });
    }
    if (
      referralCode.max_uses != null &&
      (referralCode.total_conversions ?? 0) >= referralCode.max_uses
    ) {
      return NextResponse.json<ValidateResponse>({
        valid: false,
        code_type: referralCode.code_type ?? "referral",
        reward: NO_REWARD,
        reason: "code_exhausted",
      });
    }
    // Self-referral: chỉ block affiliate (cash commission, risk tài chính 40%).
    // Referral cho phép self-use — user nhận discount 10% + voucher 100K sau check-in D1.
    if (
      user &&
      user.id === referralCode.user_id &&
      referralCode.code_type === "affiliate"
    ) {
      return NextResponse.json<ValidateResponse>({
        valid: false,
        code_type: referralCode.code_type ?? "affiliate",
        reward: NO_REWARD,
        reason: "self_affiliate",
      });
    }

    const { data: referrerProfile } = await service
      .from("profiles")
      .select("full_name")
      .eq("id", referralCode.user_id)
      .single();

    const fullName = referrerProfile?.full_name?.trim() ?? "";
    const firstName = fullName.split(/\s+/)[0] || "Người dùng";

    const reward = resolveReferralReward({
      id: referralCode.id,
      code: referralCode.code,
      code_type: referralCode.code_type,
      referee_reward_type: referralCode.referee_reward_type,
      referee_reward_value: referralCode.referee_reward_value,
      referrer_name: firstName,
    });

    return NextResponse.json<ValidateResponse>({
      valid: reward.type !== "none",
      code_type: referralCode.code_type ?? "referral",
      reward,
      referrer_name: firstName,
    });
  }

  // ── Fallback: profiles.referral_code (legacy) ────────────────────────────
  const { data: profileCode } = await service
    .from("profiles")
    .select("id, full_name, referral_code")
    .eq("referral_code", code)
    .maybeSingle();

  if (profileCode) {
    // profiles.referral_code (legacy fallback) — code_type='referral' by default,
    // self-use ALLOWED (referral cho phép).
    const firstName = (profileCode.full_name?.trim() ?? "").split(/\s+/)[0] || "Người dùng";
    const reward = resolveReferralReward({
      id: null,
      code,
      code_type: "referral",
      referee_reward_type: null,
      referee_reward_value: null,
      referrer_name: firstName,
    });
    return NextResponse.json<ValidateResponse>({
      valid: reward.type !== "none",
      code_type: "referral",
      reward,
      referrer_name: firstName,
    });
  }

  // ── Try voucher (must belong to current user) ────────────────────────────
  if (user) {
    const { data: voucher } = await service
      .from("vouchers")
      .select("id, code, user_id, remaining_amount, status, expires_at")
      .eq("code", code)
      .eq("user_id", user.id)
      .maybeSingle();

    if (voucher) {
      if (voucher.status !== "active") {
        return NextResponse.json<ValidateResponse>({
          valid: false,
          code_type: "voucher",
          reward: NO_REWARD,
          reason: "voucher_inactive",
        });
      }
      if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
        return NextResponse.json<ValidateResponse>({
          valid: false,
          code_type: "voucher",
          reward: NO_REWARD,
          reason: "voucher_expired",
        });
      }
      const reward = resolveVoucherReward({
        id: voucher.id,
        code: voucher.code,
        remaining_amount: voucher.remaining_amount,
      });
      return NextResponse.json<ValidateResponse>({
        valid: reward.type !== "none",
        code_type: "voucher",
        reward,
      });
    }
  }

  return NextResponse.json<ValidateResponse>({
    valid: false,
    code_type: null,
    reward: NO_REWARD,
    reason: "code_not_found",
  });
}
