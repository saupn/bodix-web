import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createServiceClient } from "@/lib/supabase/service";

function todayStart(): string {
  return new Date().toISOString().slice(0, 10) + "T00:00:00.000Z";
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10) + "T00:00:00.000Z";
}

export async function GET() {
  const verified = await verifyAdmin();
  if (verified.error) return verified.error;

  const supabase = createServiceClient();
  const today = todayStart();

  // 1. Nudges hôm nay (morning + evening + rescue types)
  const { count: nudgesToday } = await supabase
    .from("nudge_logs")
    .select("*", { count: "exact", head: true })
    .gte("sent_at", today);

  // 2. Rescue triggers hôm nay
  const { count: rescueToday } = await supabase
    .from("rescue_interventions")
    .select("*", { count: "exact", head: true })
    .gte("created_at", today);

  // 3. Check-in sau nudge (7 ngày gần nhất)
  const sevenDaysAgo = daysAgo(7);
  const { data: nudges7d } = await supabase
    .from("nudge_logs")
    .select("id, led_to_checkin")
    .gte("sent_at", sevenDaysAgo);

  const total = nudges7d?.length ?? 0;
  const ledToCheckin = nudges7d?.filter((n) => n.led_to_checkin).length ?? 0;
  const checkinRate = total > 0 ? Math.round((ledToCheckin / total) * 100) : 0;

  // 4. Users at risk (active enrollments with risk_score > 50)
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id")
    .eq("status", "active");

  let usersAtRisk = 0;
  if (enrollments?.length) {
    const scores = await Promise.all(
      enrollments.map((e) =>
        supabase.rpc("calculate_risk_score", { p_enrollment_id: e.id })
      )
    );
    usersAtRisk = scores.filter(
      (s) => s.data && typeof s.data === "number" && s.data > 50
    ).length;
  }

  // 5. Chart data: 7 ngày gần nhất — nudges sent vs led_to_checkin
  const chartData: { date: string; nudges: number; checkins: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayStart = dateStr + "T00:00:00.000Z";
    const dayEnd = dateStr + "T23:59:59.999Z";

    const { count: nCount } = await supabase
      .from("nudge_logs")
      .select("*", { count: "exact", head: true })
      .gte("sent_at", dayStart)
      .lte("sent_at", dayEnd);

    const { count: cCount } = await supabase
      .from("nudge_logs")
      .select("*", { count: "exact", head: true })
      .gte("sent_at", dayStart)
      .lte("sent_at", dayEnd)
      .eq("led_to_checkin", true);

    chartData.push({
      date: dateStr,
      nudges: nCount ?? 0,
      checkins: cCount ?? 0,
    });
  }

  return NextResponse.json({
    nudgesToday: nudgesToday ?? 0,
    rescueToday: rescueToday ?? 0,
    checkinRate,
    usersAtRisk,
    chartData,
  });
}
