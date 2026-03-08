import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const VALID_SLUGS = ["bodix-21", "bodix-6w", "bodix-12w"] as const;

// ─── Referral code validation (inline — no HTTP round-trip) ───────────────────

interface ReferralCodeInfo {
  id: string
  referee_reward_type: string
  referee_reward_value: number
}

async function resolveReferralCode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  code: string,
  userId: string
): Promise<{ valid: true; info: ReferralCodeInfo; discount: number; priceAfterDiscount: number; originalPrice: number } |
            { valid: false }> {
  // We don't know the program price yet — return the code info; price is passed by caller
  const { data } = await supabase
    .from("referral_codes")
    .select("id, user_id, referee_reward_type, referee_reward_value, is_active, max_uses, total_conversions, expires_at")
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
      referee_reward_type: data.referee_reward_type,
      referee_reward_value: data.referee_reward_value,
    },
    // placeholder — caller must fill discount + priceAfterDiscount with actual price
    discount: 0,
    priceAfterDiscount: 0,
    originalPrice: 0,
  };
}

function computeDiscount(
  originalPrice: number,
  rewardType: string,
  rewardValue: number
): number {
  if (rewardType === "discount_percent") {
    return Math.round(originalPrice * (rewardValue / 100));
  }
  if (rewardType === "discount_fixed") {
    return Math.min(rewardValue, originalPrice); // never exceed price
  }
  return 0;
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  let body: { slug?: string; payment_method?: string; referral_code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const slug = body.slug;
  if (!slug || !VALID_SLUGS.includes(slug as (typeof VALID_SLUGS)[number])) {
    return NextResponse.json({ error: "Chương trình không hợp lệ." }, { status: 400 });
  }

  const paymentMethod = body.payment_method ?? "bank_transfer";
  if (paymentMethod !== "bank_transfer") {
    return NextResponse.json(
      { error: "Hiện chỉ hỗ trợ chuyển khoản ngân hàng." },
      { status: 400 }
    );
  }

  // ── Fetch program ─────────────────────────────────────────────────────────
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

  // ── Duplicate enrollment guard ────────────────────────────────────────────
  const { data: existing } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("program_id", program.id)
    .in("status", ["pending_payment", "active"])
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Bạn đã đăng ký chương trình này.", redirect: "/app/checkout/success?slug=" + slug },
      { status: 409 }
    );
  }

  // ── Resolve referral code (soft-fail) ─────────────────────────────────────
  let referralCodeId: string | null = null;
  let discountAmount = 0;
  let finalPrice = program.price_vnd;
  let referralApplied = false;

  if (body.referral_code?.trim()) {
    const result = await resolveReferralCode(supabase, body.referral_code, user.id);
    if (result.valid) {
      discountAmount = computeDiscount(
        program.price_vnd,
        result.info.referee_reward_type,
        result.info.referee_reward_value
      );
      if (discountAmount > 0) {
        referralCodeId = result.info.id;
        finalPrice = program.price_vnd - discountAmount;
        referralApplied = true;
      }
    }
    // Invalid code → silently ignored (soft fail as per spec)
  }

  // ── Insert enrollment ─────────────────────────────────────────────────────
  const service = createServiceClient();
  const { data: enrollment, error } = await service
    .from("enrollments")
    .insert({
      user_id: user.id,
      program_id: program.id,
      cohort_id: cohort?.id ?? null,
      status: "pending_payment",
      payment_method: paymentMethod,
      amount_paid: 0,
      referral_code_id: referralCodeId,
      referral_discount_amount: discountAmount,
    })
    .select("id")
    .single();

  if (error || !enrollment) {
    console.error("[checkout/create] insert failed:", error);
    return NextResponse.json(
      { error: "Không thể tạo đơn đăng ký. Vui lòng thử lại." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    enrollment_id: enrollment.id,
    pricing: {
      original_price: program.price_vnd,
      discount_amount: discountAmount,
      final_price: finalPrice,
      referral_applied: referralApplied,
    },
    redirect: `/app/checkout/success?slug=${slug}`,
  });
}
