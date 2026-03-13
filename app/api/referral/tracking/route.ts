import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

import { REFERRAL_REWARD_AMOUNT } from '@/lib/affiliate/config';

const REWARD_PER_CONVERSION = REFERRAL_REWARD_AMOUNT;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  // ── Referral code stats ───────────────────────────────────────────────────
  const { data: code, error: codeError } = await supabase
    .from("referral_codes")
    .select("id, code, total_clicks, total_signups, total_conversions")
    .eq("user_id", user.id)
    .eq("code_type", "referral")
    .maybeSingle();

  if (codeError) {
    console.error("[referral/tracking] code fetch:", codeError);
    return NextResponse.json({ error: "Lỗi truy vấn." }, { status: 500 });
  }

  const totalClicks = code?.total_clicks ?? 0;
  const totalSignups = code?.total_signups ?? 0;
  const totalConversions = code?.total_conversions ?? 0;
  const totalEarned = totalConversions * REWARD_PER_CONVERSION;

  // ── Referral history (tracking records) ────────────────────────────────────
  const { data: trackings, error: trackError } = await supabase
    .from("referral_tracking")
    .select("id, referred_id, status, clicked_at, signed_up_at, converted_at, referral_source")
    .eq("referrer_id", user.id)
    .order("clicked_at", { ascending: false })
    .limit(50);

  if (trackError) {
    console.error("[referral/tracking] trackings fetch:", trackError);
  }

  const referredIds = (trackings ?? [])
    .map((t) => t.referred_id)
    .filter((id): id is string => !!id);

  let profileMap = new Map<string, { full_name: string | null }>();
  if (referredIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", referredIds);
    profileMap = new Map((profiles ?? []).map((p) => [p.id, { full_name: p.full_name }]));
  }

  const history = (trackings ?? []).map((t) => {
    const profile = t.referred_id ? profileMap.get(t.referred_id) : null;
    const fullName = profile?.full_name?.trim() ?? "";
    const parts = fullName.split(/\s+/).filter(Boolean);
    const displayName =
      parts.length >= 2
        ? `${parts[0]} ${parts[parts.length - 1][0]}.`
        : fullName || "Ẩn danh";

    const date = t.converted_at ?? t.signed_up_at ?? t.clicked_at ?? "";
    const reward =
      t.status === "converted" || t.status === "completed"
        ? REWARD_PER_CONVERSION
        : null;

    return {
      id: t.id,
      display_name: displayName,
      status: t.status,
      date,
      reward,
    };
  });

  // ── Credit balance ─────────────────────────────────────────────────────────
  const { data: balanceData } = await supabase.rpc("get_credit_balance", {
    p_user_id: user.id,
  });
  const balance =
    typeof balanceData === "number"
      ? balanceData
      : Array.isArray(balanceData) && balanceData.length > 0
        ? Number(balanceData[0]) ?? 0
        : 0;

  // ── Credit history (last 5) ───────────────────────────────────────────────
  const { data: creditRows } = await supabase
    .from("user_credits")
    .select("id, amount, balance_after, transaction_type, description, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const credit_history = (creditRows ?? []).map((r) => ({
    id: r.id,
    amount: r.amount,
    balance_after: r.balance_after,
    transaction_type: r.transaction_type,
    description: r.description ?? "",
    created_at: r.created_at,
  }));

  return NextResponse.json({
    stats: {
      total_clicks: totalClicks,
      total_signups: totalSignups,
      total_conversions: totalConversions,
      total_earned: totalEarned,
    },
    history,
    balance,
    credit_history,
  });
}
