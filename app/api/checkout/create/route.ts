import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  resolveReferralReward,
  resolveVoucherReward,
  NO_REWARD,
  type ResolvedReward,
} from "@/lib/checkout/resolve-reward";
import { calculateCheckoutTotal } from "@/lib/checkout/calculate-total";

const VALID_SLUGS = ["bodix-21", "bodix-6w", "bodix-12w"] as const;

// ─── Referral / affiliate code resolution ────────────────────────────────────

interface ResolvedCode {
  id: string | null;
  user_id: string;
  code_type: "referral" | "affiliate";
  reward: ResolvedReward;
}

async function resolveReferralCode(
  code: string,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
): Promise<{ valid: true; info: ResolvedCode } | { valid: false }> {
  const upperCode = code.trim().toUpperCase();

  // QUAN TRỌNG: lookup qua `service` (bypass RLS). RLS trên referral_codes là
  // `auth.uid() = user_id` → nếu dùng client của buyer, code của NGƯỜI KHÁC sẽ
  // không thấy → rơi vào legacy fallback (id=null) → enrollment.referral_code_id
  // null → webhook KHÔNG tạo commission. Đây là root cause "/referral hiển thị 0".
  const { data } = await service
    .from("referral_codes")
    .select(
      "id, user_id, code, code_type, referee_reward_type, referee_reward_value, is_active, max_uses, total_conversions, expires_at",
    )
    .eq("code", upperCode)
    .maybeSingle();

  if (data) {
    if (!data.is_active) return { valid: false };
    if (data.expires_at && new Date(data.expires_at) < new Date()) return { valid: false };
    if (data.max_uses != null && data.total_conversions >= data.max_uses) return { valid: false };

    const codeType: "referral" | "affiliate" = data.code_type ?? "referral";

    // BD-REFERRAL-VOUCHER-FLOW: cho phép self-referral với code_type='referral'
    // (user nhận discount 10% + voucher 100K sau khi check-in D1).
    // Affiliate cash commission KHÔNG được self (risk tài chính 40%).
    if (data.user_id === userId && codeType === "affiliate") {
      return { valid: false };
    }

    const { data: referrerProfile } = await service
      .from("profiles")
      .select("full_name")
      .eq("id", data.user_id)
      .single();
    const firstName =
      (referrerProfile?.full_name?.trim() ?? "").split(/\s+/)[0] || "Người dùng";

    const reward = resolveReferralReward({
      id: data.id,
      code: data.code,
      code_type: codeType,
      referee_reward_type: data.referee_reward_type,
      referee_reward_value: data.referee_reward_value,
      referrer_name: firstName,
    });

    if (reward.type === "none") return { valid: false };

    return {
      valid: true,
      info: { id: data.id, user_id: data.user_id, code_type: codeType, reward },
    };
  }

  // Legacy fallback: profiles.referral_code (no row in referral_codes)
  const { data: profile } = await service
    .from("profiles")
    .select("id, full_name, referral_code")
    .eq("referral_code", upperCode)
    .maybeSingle();

  if (!profile) return { valid: false };
  // Legacy fallback path (profiles.referral_code) chỉ phục vụ referral code
  // (không có affiliate qua path này), nên cho phép self-referral. Không cần
  // block profile.id === userId nữa.

  const firstName = (profile.full_name?.trim() ?? "").split(/\s+/)[0] || "Người dùng";
  const reward = resolveReferralReward({
    id: null,
    code: upperCode,
    code_type: "referral",
    referee_reward_type: null,
    referee_reward_value: null,
    referrer_name: firstName,
  });
  if (reward.type === "none") return { valid: false };

  return {
    valid: true,
    info: { id: null, user_id: profile.id, code_type: "referral", reward },
  };
}

interface ResolvedVoucher {
  id: string;
  reward: ResolvedReward;
}

async function resolveVoucher(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  code: string,
  userId: string,
): Promise<{ valid: true; voucher: ResolvedVoucher } | { valid: false }> {
  const { data } = await service
    .from("vouchers")
    .select("id, code, user_id, remaining_amount, status, expires_at")
    .eq("code", code.trim().toUpperCase())
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return { valid: false };
  if (data.status !== "active") return { valid: false };
  if (new Date(data.expires_at) < new Date()) return { valid: false };
  if (data.remaining_amount <= 0) return { valid: false };

  const reward = resolveVoucherReward({
    id: data.id,
    code: data.code,
    remaining_amount: data.remaining_amount,
  });
  if (reward.type === "none") return { valid: false };

  return { valid: true, voucher: { id: data.id, reward } };
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  let body: {
    slug?: string;
    payment_method?: string;
    referral_code?: string;
    voucher_code?: string;
    voucher_codes?: string[];
    dry_run?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const dryRun =
    body.dry_run === true ||
    request.nextUrl.searchParams.get("dry_run") === "true";

  const slug = body.slug;
  if (!slug || !VALID_SLUGS.includes(slug as (typeof VALID_SLUGS)[number])) {
    return NextResponse.json({ error: "Chương trình không hợp lệ." }, { status: 400 });
  }

  const paymentMethod = body.payment_method ?? "bank_transfer";
  if (paymentMethod !== "bank_transfer") {
    return NextResponse.json(
      { error: "Hiện chỉ hỗ trợ chuyển khoản ngân hàng." },
      { status: 400 },
    );
  }

  const { data: program } = await supabase
    .from("programs")
    .select("id, name, slug, price_vnd")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!program) {
    return NextResponse.json({ error: "Chương trình không tồn tại." }, { status: 404 });
  }

  const service = createServiceClient();

  // ── Resolve referral / affiliate code ────────────────────────────────────
  let referralCodeId: string | null = null;
  let codeType: "referral" | "affiliate" | null = null;
  let referralReward: ResolvedReward = NO_REWARD;

  if (body.referral_code?.trim()) {
    const result = await resolveReferralCode(
      body.referral_code,
      user.id,
      service,
    );
    if (result.valid) {
      referralCodeId = result.info.id;
      codeType = result.info.code_type;
      referralReward = result.info.reward;
    }
  }

  // ── Resolve voucher(s) ───────────────────────────────────────────────────
  let voucherId: string | null = null;
  let voucherReward: ResolvedReward = NO_REWARD;

  const rawCodes: string[] = Array.isArray(body.voucher_codes) && body.voucher_codes.length > 0
    ? body.voucher_codes.map((c) => String(c).trim()).filter(Boolean)
    : body.voucher_code?.trim()
      ? body.voucher_code.split(",").map((c) => c.trim()).filter(Boolean)
      : [];

  // First compute subtotal after referral discount to know how much voucher cap is
  const preview = calculateCheckoutTotal({
    basePriceVnd: program.price_vnd,
    referralReward,
  });
  let voucherRemainingCap = preview.total;
  let voucherSum = 0;
  for (const code of rawCodes) {
    if (voucherRemainingCap <= 0) break;
    const vResult = await resolveVoucher(service, code, user.id);
    if (!vResult.valid) continue;
    const take = Math.min(vResult.voucher.reward.value, voucherRemainingCap);
    if (take <= 0) continue;
    voucherSum += take;
    voucherRemainingCap -= take;
    if (!voucherId) voucherId = vResult.voucher.id;
  }
  if (voucherSum > 0) {
    voucherReward = {
      type: "fixed",
      value: voucherSum,
      source: "db",
      label: rawCodes.length > 1 ? `Voucher (${rawCodes.length} mã)` : `Voucher ${rawCodes[0] ?? ""}`.trim(),
    };
  }

  // ── Final pricing via single source of truth ─────────────────────────────
  const breakdown = calculateCheckoutTotal({
    basePriceVnd: program.price_vnd,
    referralReward,
    voucherReward,
  });

  const referralDiscountAmount =
    breakdown.discounts.find((d) => d.kind === "referral" || d.kind === "affiliate")?.amount ?? 0;
  const voucherDiscountAmount =
    breakdown.discounts.find((d) => d.kind === "voucher")?.amount ?? 0;
  const finalPrice = breakdown.total;

  const pricingResponse = {
    original_price: program.price_vnd,
    subtotal: breakdown.subtotal,
    referral_discount_amount: referralDiscountAmount,
    voucher_discount_amount: voucherDiscountAmount,
    final_price: finalPrice,
    code_type: codeType,
    referral_applied: referralCodeId !== null || referralReward.type !== "none",
    voucher_applied: voucherId !== null,
    referral_reward_source: referralReward.source,
    discounts: breakdown.discounts,
  };

  // ── Dry-run: return pricing only, no DB writes ───────────────────────────
  if (dryRun) {
    return NextResponse.json({
      success: true,
      dry_run: true,
      pricing: pricingResponse,
    });
  }

  // ── Resolve / promote enrollment ─────────────────────────────────────────
  let pendingEnrollment: { id: string } | null = null;
  {
    const { data: existing } = await supabase
      .from("enrollments")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("program_id", program.id)
      .in("status", [
        "trial",
        "trial_completed",
        "pending_payment",
        "paid_waiting_cohort",
        "active",
        "completed",
      ])
      .order("enrolled_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing && (existing.status === "paid_waiting_cohort" || existing.status === "active")) {
      return NextResponse.json(
        { error: "Bạn đã thanh toán chương trình này rồi.", redirect: "/app" },
        { status: 409 },
      );
    }

    if (
      existing &&
      (existing.status === "trial" ||
        existing.status === "trial_completed" ||
        existing.status === "pending_payment")
    ) {
      if (existing.status !== "pending_payment") {
        const { error: promoteErr } = await service
          .from("enrollments")
          .update({ status: "pending_payment" })
          .eq("id", existing.id);
        if (promoteErr) {
          console.error("[checkout/create] promote enrollment:", promoteErr);
          return NextResponse.json(
            { error: "Không thể cập nhật trạng thái đăng ký." },
            { status: 500 },
          );
        }
      }
      pendingEnrollment = { id: existing.id };
    } else {
      const { data: newEnrollment, error: createErr } = await service
        .from("enrollments")
        .insert({
          user_id: user.id,
          program_id: program.id,
          status: "pending_payment",
          current_day: 0,
        })
        .select("id")
        .single();

      if (createErr || !newEnrollment) {
        console.error("[checkout/create] create enrollment:", createErr);
        return NextResponse.json(
          { error: "Không thể khởi tạo đơn đăng ký." },
          { status: 500 },
        );
      }
      pendingEnrollment = { id: newEnrollment.id };
    }
  }

  // ── Update enrollment with discount info ─────────────────────────────────
  const { error } = await service
    .from("enrollments")
    .update({
      payment_method: paymentMethod,
      referral_code_id: referralCodeId,
      referral_discount_amount: referralDiscountAmount,
      voucher_id: voucherId,
      voucher_discount_amount: voucherDiscountAmount,
    })
    .eq("id", pendingEnrollment.id);

  if (error) {
    console.error("[checkout/create] update failed:", error);
    return NextResponse.json(
      { error: "Không thể cập nhật đơn đăng ký. Vui lòng thử lại." },
      { status: 500 },
    );
  }

  // ── SePay payment code ───────────────────────────────────────────────────
  const { data: codeData, error: codeError } = await service.rpc(
    "generate_bodix_payment_code",
  );

  if (codeError || !codeData) {
    console.error("[checkout/create] payment_code rpc:", codeError);
    return NextResponse.json(
      { error: "Không thể tạo mã thanh toán. Vui lòng thử lại." },
      { status: 500 },
    );
  }

  const paymentCode = codeData as string;
  const paymentSequence = parseInt(paymentCode.replace(/^BX/, ""), 10);

  // ── Insert/update order ──────────────────────────────────────────────────
  const { data: existingPending } = await service
    .from("orders")
    .select("id")
    .eq("user_id", user.id)
    .eq("program", slug)
    .eq("payment_status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let orderId: number | null = null;
  if (existingPending) {
    const { data: updated, error: updErr } = await service
      .from("orders")
      .update({
        amount: finalPrice,
        payment_method: paymentMethod,
        payment_code: paymentCode,
        payment_sequence: paymentSequence,
        referral_code: body.referral_code?.trim() || null,
      })
      .eq("id", existingPending.id)
      .select("id")
      .single();
    if (updErr) {
      console.error("[checkout/create] order update:", updErr);
      return NextResponse.json(
        { error: "Không thể cập nhật đơn hàng." },
        { status: 500 },
      );
    }
    orderId = updated.id;
  } else {
    const orderCode = `BX-${Date.now()}-${user.id.slice(0, 8)}`;
    const { data: inserted, error: insErr } = await service
      .from("orders")
      .insert({
        order_code: orderCode,
        user_id: user.id,
        program: slug,
        amount: finalPrice,
        payment_method: paymentMethod,
        payment_status: "pending",
        payment_code: paymentCode,
        payment_sequence: paymentSequence,
        referral_code: body.referral_code?.trim() || null,
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      console.error("[checkout/create] order insert:", insErr);
      return NextResponse.json(
        { error: "Không thể tạo đơn hàng." },
        { status: 500 },
      );
    }
    orderId = inserted.id;
  }

  return NextResponse.json({
    success: true,
    enrollment_id: pendingEnrollment.id,
    order_id: orderId,
    payment_code: paymentCode,
    pricing: pricingResponse,
    redirect: `/checkout/${orderId}`,
  });
}
