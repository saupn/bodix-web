import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+84") && digits.length === 11) return `+84${digits.slice(2)}`;
  if (digits.startsWith("0") && digits.length === 10) return `+84${digits.slice(1)}`;
  if (digits.length === 9) return `+84${digits}`;
  return null;
}

export async function POST(request: NextRequest) {
  let body: {
    full_name?: string;
    date_of_birth?: string | null;
    gender?: string;
    fitness_goal?: string[];
    phone?: string | null;
    phone_verified?: boolean;
    referred_by?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Phiên đăng nhập hết hạn." },
      { status: 401 }
    );
  }

  const service = createServiceClient();

  // Build update object — trial starts when user selects a program, not here
  const updateData: Record<string, unknown> = {
    full_name: body.full_name?.trim() || null,
    date_of_birth: body.date_of_birth || null,
    gender: body.gender || null,
    fitness_goal: body.fitness_goal || [],
    onboarding_completed: true,
  };

  if (body.phone) {
    const normalizedPhone = normalizePhone(body.phone);
    if (normalizedPhone) {
      updateData.phone = normalizedPhone;
      updateData.phone_verified = body.phone_verified ?? false;
    }
  }

  if (body.referred_by?.trim()) {
    const code = body.referred_by.trim().toUpperCase();
    updateData.referred_by = code;
  }

  const { error } = await service
    .from("profiles")
    .update(updateData)
    .eq("id", user.id);

  if (error) {
    console.error("[complete-onboarding]", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  // Ghi nhận referral: tạo referrals row + tăng referral_count của referrer
  if (body.referred_by?.trim()) {
    const code = body.referred_by.trim().toUpperCase();
    let referrerId: string | null = null;

    const { data: referrerProfile } = await service
      .from("profiles")
      .select("id")
      .eq("referral_code", code)
      .maybeSingle();
    if (referrerProfile) referrerId = referrerProfile.id;

    if (!referrerId) {
      const { data: refCode } = await service
        .from("referral_codes")
        .select("user_id")
        .eq("code", code)
        .maybeSingle();
      if (refCode) referrerId = refCode.user_id;
    }

    if (referrerId && referrerId !== user.id) {
      await service.from("referrals").insert({
        referrer_id: referrerId,
        referrer_code: code,
        referred_id: user.id,
        referred_email: user.email ?? null,
        status: "registered",
      });

      const { data: refProfile } = await service
        .from("profiles")
        .select("referral_count")
        .eq("id", referrerId)
        .single();
      const newCount = (refProfile?.referral_count ?? 0) + 1;
      await service
        .from("profiles")
        .update({ referral_count: newCount })
        .eq("id", referrerId);
    }
  }

  return NextResponse.json({ success: true });
}
