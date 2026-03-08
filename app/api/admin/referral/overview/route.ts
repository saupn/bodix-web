import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  return data?.role === "admin";
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  if (!(await requireAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  }

  const service = createServiceClient();

  const { data: refStats } = await service
    .from("referral_tracking")
    .select("id, status, conversion_amount, converted_at, referred_id");

  const convertedRefs = (refStats ?? []).filter((r) => r.status === "converted" || r.status === "completed");
  const totalReferralConversions = convertedRefs.length;
  const totalRevenue = convertedRefs.reduce((s, r) => s + (r.conversion_amount ?? 0), 0);

  const { count: referralEnrollmentsCount } = await service
    .from("enrollments")
    .select("*", { count: "exact", head: true })
    .in("status", ["active", "completed"])
    .not("referral_code_id", "is", null);

  const { count: totalEnrollmentsCount } = await service
    .from("enrollments")
    .select("*", { count: "exact", head: true })
    .in("status", ["active", "completed"]);

  const totalAllConversions = totalEnrollmentsCount ?? 0;
  const totalReferralConversionsFromEnrollments = referralEnrollmentsCount ?? 0;

  const totalClicks = (refStats ?? []).length;
  const totalSignups = (refStats ?? []).filter((r) => r.referred_id).length;
  const conversionRate = totalSignups > 0
    ? Math.round((totalReferralConversions / totalSignups) * 100)
    : 0;

  const referralShare = totalAllConversions > 0
    ? Math.round((totalReferralConversionsFromEnrollments / totalAllConversions) * 100)
    : 0;

  const conversionsByWeek = new Map<string, number>();
  const revenueByWeek = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    const key = d.toISOString().slice(0, 10);
    const weekStart = new Date(d);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekKey = weekStart.toISOString().slice(0, 10);
    conversionsByWeek.set(weekKey, 0);
    revenueByWeek.set(weekKey, 0);
  }

  for (const r of convertedRefs) {
    if (!r.converted_at) continue;
    const d = new Date(r.converted_at);
    d.setDate(d.getDate() - d.getDay());
    const weekKey = d.toISOString().slice(0, 10);
    const cur = conversionsByWeek.get(weekKey) ?? 0;
    conversionsByWeek.set(weekKey, cur + 1);
    const rev = revenueByWeek.get(weekKey) ?? 0;
    revenueByWeek.set(weekKey, rev + (r.conversion_amount ?? 0));
  }

  const chartData = Array.from(conversionsByWeek.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, conversions]) => ({
      week: `Tuần ${week.slice(5, 7)}/${week.slice(0, 4)}`,
      conversions,
      revenue: revenueByWeek.get(week) ?? 0,
    }));

  return NextResponse.json({
    total_referrals: totalReferralConversions,
    total_clicks: totalClicks,
    total_signups: totalSignups,
    conversion_rate: conversionRate,
    total_revenue: totalRevenue,
    referral_share: referralShare,
    total_conversions: totalReferralConversionsFromEnrollments,
    total_all_conversions: totalAllConversions,
    chart_data: chartData,
  });
}
