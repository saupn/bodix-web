import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  return data?.role === "admin";
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  if (!(await requireAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const statusFilter = params.get("status");
  const dateFrom = params.get("date_from");
  const dateTo = params.get("date_to");
  const page = Math.max(0, parseInt(params.get("page") ?? "0", 10));
  const limit = 50;

  const service = createServiceClient();

  let query = service
    .from("referral_tracking")
    .select(`
      id, referrer_id, referred_id, status, conversion_amount, converted_at,
      signed_up_at, clicked_at, referral_code_id, program_id
    `)
    .in("status", ["signed_up", "converted", "completed"])
    .order("converted_at", { ascending: false, nullsFirst: true })
    .order("signed_up_at", { ascending: false, nullsFirst: true })
    .order("clicked_at", { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (statusFilter) query = query.eq("status", statusFilter);
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");

  const { data: trackings, error } = await query;

  if (error) {
    console.error("[admin/referral/conversions] GET:", error);
    return NextResponse.json({ error: "Lỗi truy vấn." }, { status: 500 });
  }

  if (!trackings?.length) {
    return NextResponse.json({ conversions: [], page, has_more: false });
  }

  const referrerIds = [...new Set(trackings.map((t) => t.referrer_id))];
  const referredIds = [...new Set(trackings.map((t) => t.referred_id).filter(Boolean))] as string[];
  const programIds = [...new Set(trackings.map((t) => t.program_id).filter(Boolean))] as string[];

  const [profilesRes, programsRes, codesRes] = await Promise.all([
    service.from("profiles").select("id, full_name").in("id", [...referrerIds, ...referredIds]),
    programIds.length ? service.from("programs").select("id, name").in("id", programIds) : { data: [] },
    service.from("referral_codes").select("id, referee_reward_value, referee_reward_type").in("id", trackings.map((t) => t.referral_code_id).filter(Boolean)),
  ]);

  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
  const programMap = new Map((programsRes.data ?? []).map((p) => [p.id, p.name]));
  const codeMap = new Map((codesRes.data ?? []).map((c) => [c.id, c]));

  const conversions = trackings.map((t) => {
    const referrerName = profileMap.get(t.referrer_id)?.full_name ?? "—";
    const referredName = t.referred_id ? (profileMap.get(t.referred_id)?.full_name ?? "—") : "—";
    const amount = t.conversion_amount ?? 0;
    const code = t.referral_code_id ? codeMap.get(t.referral_code_id) : null;
    const discountPct = code?.referee_reward_type === "discount_percent" ? (code.referee_reward_value ?? 0) : 0;
    const discount = Math.round(amount * (discountPct / 100));
    const reward = code?.referee_reward_type === "discount_percent" ? 50000 : 0;

    return {
      id: t.id,
      date: t.converted_at ?? t.signed_up_at ?? t.clicked_at,
      referrer_name: referrerName,
      referee_name: referredName,
      program: programMap.get(t.program_id) ?? "—",
      amount,
      discount,
      reward: t.status === "converted" || t.status === "completed" ? reward : 0,
      status: t.status,
    };
  });

  return NextResponse.json({
    conversions,
    page,
    has_more: trackings.length === limit,
  });
}
