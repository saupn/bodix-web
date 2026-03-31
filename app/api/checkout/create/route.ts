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
  id: string
  code_type: "referral" | "affiliate"
}

async function resolveReferralCode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  code: string,
  userId: string
): Promise<{ valid: true; info: ResolvedCode } | { valid: false }> {
  const { data } = await supabase
    .from("referral_codes")
    .select("id, user_id, code_type, is_active, max_uses, total_conversions, expires_at")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();

  if (!data) return { valid: false };
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

  // ── Chỉ cho phép checkout khi đã ở pending_payment (admin đã chọn) ──────
  const { data: pendingEnrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("program_id", program.id)
    .eq("status", "pending_payment")
    .maybeSingle();

  if (!pendingEnrollment) {
    const { data: existingOther } = await supabase
      .from("enrollments")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("program_id", program.id)
      .in("status", ["paid_waiting_cohort", "active"])
      .maybeSingle();

    if (existingOther) {
      return NextResponse.json(
        { error: "Bạn đã thanh toán chương trình này rồi.", redirect: "/app" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Bạn chưa được chọn tham gia. Vui lòng chờ thông báo từ BodiX." },
      { status: 403 }
    );
  }

  const service = createServiceClient();

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

  // ── Resolve voucher (soft-fail) ───────────���───────────────────────────────
  let voucherId: string | null = null;
  let voucherDiscountAmount = 0;

  const priceAfterCodeDiscount = program.price_vnd - referralDiscountAmount;

  if (body.voucher_code?.trim()) {
    const vResult = await resolveVoucher(service, body.voucher_code, user.id);
    if (vResult.valid) {
      // Voucher can cover up to the remaining price after % discount
      voucherDiscountAmount = Math.min(vResult.voucher.remaining_amount, priceAfterCodeDiscount);
      if (voucherDiscountAmount > 0) {
        voucherId = vResult.voucher.id;
      }
    }
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

  return NextResponse.json({
    success: true,
    enrollment_id: pendingEnrollment.id,
    pricing: {
      original_price: program.price_vnd,
      referral_discount_amount: referralDiscountAmount,
      voucher_discount_amount: voucherDiscountAmount,
      final_price: finalPrice,
      code_type: codeType,
      referral_applied: referralCodeId !== null,
      voucher_applied: voucherId !== null,
    },
    redirect: `/app/checkout/success?slug=${slug}`,
  });
}
