import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  REFERRAL_DISCOUNT_PERCENT,
  AFFILIATE_DISCOUNT_PERCENT,
} from "@/lib/affiliate/config";

const VALID_SLUGS = ["bodix-21", "bodix-6w", "bodix-12w"] as const;

// ─── Referral / affiliate code validation ─────────────────────────────────────

interface ResolvedCode {
  /** null khi code đến từ profiles.referral_code (chưa có row referral_codes) */
  id: string | null
  code_type: "referral" | "affiliate"
}

async function resolveReferralCode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  code: string,
  userId: string
): Promise<{ valid: true; info: ResolvedCode } | { valid: false }> {
  const upperCode = code.trim().toUpperCase();

  // Thử bảng referral_codes trước
  const { data } = await supabase
    .from("referral_codes")
    .select("id, user_id, code_type, is_active, max_uses, total_conversions, expires_at")
    .eq("code", upperCode)
    .maybeSingle();

  if (data) {
    if (!data.is_active) return { valid: false };
    if (data.expires_at && new Date(data.expires_at) < new Date()) return { valid: false };
    if (data.max_uses != null && data.total_conversions >= data.max_uses) return { valid: false };
    if (data.user_id === userId) return { valid: false }; // self-referral

    return {
      valid: true,
      info: {
        id: data.id,
        code_type: data.code_type ?? "referral",
      },
    };
  }

  // Fallback: tìm trong profiles.referral_code (mã user cũ chưa có row referral_codes)
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, referral_code")
    .eq("referral_code", upperCode)
    .maybeSingle();

  if (!profile) return { valid: false };
  if (profile.id === userId) return { valid: false }; // self-referral

  return {
    valid: true,
    info: {
      // Không có row referral_codes → id=null. Caller xử lý: không update
      // total_conversions vì không có row để update.
      id: null,
      code_type: "referral",
    },
  };
}

function computeDiscount(originalPrice: number, codeType: "referral" | "affiliate"): number {
  const pct = codeType === "affiliate" ? AFFILIATE_DISCOUNT_PERCENT : REFERRAL_DISCOUNT_PERCENT;
  return Math.round(originalPrice * (pct / 100));
}

// ─── Voucher validation ───────────────────────────────────────────────────────

interface ResolvedVoucher {
  id: string
  remaining_amount: number
}

async function resolveVoucher(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  code: string,
  userId: string
): Promise<{ valid: true; voucher: ResolvedVoucher } | { valid: false }> {
  const { data } = await service
    .from("vouchers")
    .select("id, user_id, remaining_amount, status, expires_at")
    .eq("code", code.trim().toUpperCase())
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return { valid: false };
  if (data.status !== "active") return { valid: false };
  if (new Date(data.expires_at) < new Date()) return { valid: false };
  if (data.remaining_amount <= 0) return { valid: false };

  return {
    valid: true,
    voucher: { id: data.id, remaining_amount: data.remaining_amount },
  };
}

// ─── POST ──���────────────────────────────────��─────────────────────────��───────

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
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const slug = body.slug;
  if (!slug || !VALID_SLUGS.includes(slug as (typeof VALID_SLUGS)[number])) {
    return NextResponse.json({ error: "Ch��ơng trình không hợp lệ." }, { status: 400 });
  }

  const paymentMethod = body.payment_method ?? "bank_transfer";
  if (paymentMethod !== "bank_transfer") {
    return NextResponse.json(
      { error: "Hiện chỉ hỗ trợ chuyển khoản ngân hàng." },
      { status: 400 }
    );
  }

  // ── Fetch program ────────────────���────────────────────────────────────────
  const { data: program } = await supabase
    .from("programs")
    .select("id, name, slug, price_vnd")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!program) {
    return NextResponse.json({ error: "Chương trình không tồn tại." }, { status: 404 });
  }

  // ── Fetch next cohort (for display only at this stage) ────────────────────
  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id, name, start_date")
    .eq("program_id", program.id)
    .in("status", ["upcoming", "active"])
    .order("start_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  const service = createServiceClient();

  // ── Resolve / promote enrollment cho program này ──────────────────────────
  // Ai cũng được thanh toán: trial, trial_completed, pending_payment, completed,
  // hoặc chưa có enrollment cho program này. Chỉ chặn khi đã paid_waiting_cohort
  // hoặc đang active cho chính program này.
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
        { status: 409 }
      );
    }

    if (
      existing &&
      (existing.status === "trial" ||
        existing.status === "trial_completed" ||
        existing.status === "pending_payment")
    ) {
      // Promote sang pending_payment (idempotent nếu đã pending_payment).
      if (existing.status !== "pending_payment") {
        const { error: promoteErr } = await service
          .from("enrollments")
          .update({ status: "pending_payment" })
          .eq("id", existing.id);
        if (promoteErr) {
          console.error("[checkout/create] promote enrollment:", promoteErr);
          return NextResponse.json(
            { error: "Không thể cập nhật trạng thái đăng ký." },
            { status: 500 }
          );
        }
      }
      pendingEnrollment = { id: existing.id };
    } else {
      // Không có enrollment cho program này, hoặc đã completed — tạo mới
      // pending_payment (re-purchase / upgrade lên program khác).
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
          { status: 500 }
        );
      }
      pendingEnrollment = { id: newEnrollment.id };
    }
  }

  // ���─ Resolve referral / affiliate code (soft-fail) ���────────────────────────
  let referralCodeId: string | null = null;
  let referralDiscountAmount = 0;
  let codeType: "referral" | "affiliate" | null = null;

  if (body.referral_code?.trim()) {
    const result = await resolveReferralCode(supabase, body.referral_code, user.id);
    if (result.valid) {
      referralDiscountAmount = computeDiscount(program.price_vnd, result.info.code_type);
      if (referralDiscountAmount > 0) {
        referralCodeId = result.info.id;
        codeType = result.info.code_type;
      }
    }
  }

  // ── Resolve voucher(s) (soft-fail), cộng dồn giảm ─────────────────────────
  let voucherId: string | null = null;
  let voucherDiscountAmount = 0;

  const priceAfterCodeDiscount = program.price_vnd - referralDiscountAmount;

  const rawCodes: string[] = Array.isArray(body.voucher_codes) && body.voucher_codes.length > 0
    ? body.voucher_codes.map((c) => String(c).trim()).filter(Boolean)
    : body.voucher_code?.trim()
      ? body.voucher_code.split(",").map((c) => c.trim()).filter(Boolean)
      : [];

  let priceLeft = priceAfterCodeDiscount;
  for (const code of rawCodes) {
    if (priceLeft <= 0) break;
    const vResult = await resolveVoucher(service, code, user.id);
    if (!vResult.valid) continue;
    const take = Math.min(vResult.voucher.remaining_amount, priceLeft);
    if (take <= 0) continue;
    voucherDiscountAmount += take;
    priceLeft -= take;
    if (!voucherId) voucherId = vResult.voucher.id;
  }

  const finalPrice = Math.max(0, priceAfterCodeDiscount - voucherDiscountAmount);

  // ── Update existing pending_payment enrollment with discount info ────────
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
      { status: 500 }
    );
  }

  // ── SePay: sinh payment code unique từ DB sequence (atomic) ──────────────
  const { data: codeData, error: codeError } = await service
    .rpc("generate_bodix_payment_code");

  if (codeError || !codeData) {
    console.error("[checkout/create] payment_code rpc:", codeError);
    return NextResponse.json(
      { error: "Không thể tạo mã thanh toán. Vui lòng thử lại." },
      { status: 500 }
    );
  }

  const paymentCode = codeData as string;
  const paymentSequence = parseInt(paymentCode.replace(/^BX/, ""), 10);

  // ── Insert/upsert orders row gắn với enrollment ──────────────────────────
  // Reuse pending order nếu có (user submit lại checkout) — match theo
  // user_id + program slug + status pending. Nếu không có, tạo mới.
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
        { status: 500 }
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
        { status: 500 }
      );
    }
    orderId = inserted.id;
  }

  return NextResponse.json({
    success: true,
    enrollment_id: pendingEnrollment.id,
    order_id: orderId,
    payment_code: paymentCode,
    pricing: {
      original_price: program.price_vnd,
      referral_discount_amount: referralDiscountAmount,
      voucher_discount_amount: voucherDiscountAmount,
      final_price: finalPrice,
      code_type: codeType,
      referral_applied: referralCodeId !== null,
      voucher_applied: voucherId !== null,
    },
    redirect: `/checkout/${orderId}`,
  });
}
