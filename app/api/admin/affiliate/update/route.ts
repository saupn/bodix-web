import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

import { TIER_COMMISSION } from '@/lib/affiliate/config';

function rateToTier(rate: number): string {
  if (rate >= 40) return "basic";
  if (rate >= 30) return "silver";
  if (rate >= 25) return "gold";
  return "gold";
}

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  return data?.role === "admin";
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  if (!(await requireAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  }

  let body: {
    affiliate_id: string;
    commission_rate?: number;
    tier?: string;
    pause?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { affiliate_id, commission_rate, tier, pause } = body;

  if (!affiliate_id) {
    return NextResponse.json({ error: "Thiếu affiliate_id." }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: affiliate, error: fetchError } = await service
    .from("affiliate_profiles")
    .select("id, user_id, affiliate_tier, is_approved")
    .eq("id", affiliate_id)
    .single();

  if (fetchError || !affiliate) {
    return NextResponse.json({ error: "Affiliate không tồn tại." }, { status: 404 });
  }

  if (!affiliate.is_approved) {
    return NextResponse.json({ error: "Chỉ có thể cập nhật affiliate đã duyệt." }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (commission_rate !== undefined) {
    if (commission_rate < 1 || commission_rate > 50) {
      return NextResponse.json({ error: "commission_rate phải trong khoảng 1–50." }, { status: 400 });
    }
    updates.affiliate_tier = rateToTier(commission_rate);

    const { error: codeErr } = await service
      .from("referral_codes")
      .update({ commission_rate, updated_at: new Date().toISOString() })
      .eq("user_id", affiliate.user_id)
      .eq("code_type", "affiliate");

    if (codeErr) console.error("[admin/affiliate/update] code:", codeErr);
  }

  if (tier !== undefined) {
    const validTiers = ["basic", "silver", "gold", "platinum"];
    if (!validTiers.includes(tier)) {
      return NextResponse.json({ error: "tier không hợp lệ." }, { status: 400 });
    }
    updates.affiliate_tier = tier;

    const rate = TIER_COMMISSION[tier] ?? TIER_COMMISSION.basic;
    await service
      .from("referral_codes")
      .update({ commission_rate: rate, updated_at: new Date().toISOString() })
      .eq("user_id", affiliate.user_id)
      .eq("code_type", "affiliate");
  }

  if (Object.keys(updates).length > 1) {
    const { error: profileErr } = await service
      .from("affiliate_profiles")
      .update(updates)
      .eq("id", affiliate_id);

    if (profileErr) {
      console.error("[admin/affiliate/update] profile:", profileErr);
      return NextResponse.json({ error: "Không thể cập nhật." }, { status: 500 });
    }
  }

  if (pause !== undefined) {
    const { error: codeErr } = await service
      .from("referral_codes")
      .update({ is_active: !pause, updated_at: new Date().toISOString() })
      .eq("user_id", affiliate.user_id)
      .eq("code_type", "affiliate");

    if (codeErr) {
      console.error("[admin/affiliate/update] pause:", codeErr);
      return NextResponse.json({ error: "Không thể cập nhật trạng thái." }, { status: 500 });
    }
  }

  return NextResponse.json({ status: "ok", affiliate_id });
}
