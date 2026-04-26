import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const verified = await verifyAdmin();
  if (verified.error) return verified.error;

  const supabase = createServiceClient();

  const { data: enrollments, error: enrollError } = await supabase
    .from("enrollments")
    .select("id, user_id, current_day, status, started_at, program_id")
    .eq("status", "active")
    .order("current_day", { ascending: false });

  if (enrollError || !enrollments?.length) {
    return NextResponse.json({ rows: [] });
  }

  const userIds = [...new Set(enrollments.map((e) => e.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);
  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name?.trim() || p.email || "–"])
  );

  const programIds = [...new Set((enrollments ?? []).map((e) => e.program_id).filter(Boolean))];
  const { data: programs } = await supabase
    .from("programs")
    .select("id, name, slug")
    .in("id", programIds);
  const programMap = new Map((programs ?? []).map((p) => [p.id, p.name]));

  const { data: streaks } = await supabase
    .from("streaks")
    .select("enrollment_id, current_streak, last_checkin_date, total_completed_days")
    .in(
      "enrollment_id",
      enrollments.map((e) => e.id)
    );

  const streakMap = new Map(
    (streaks ?? []).map((s) => [s.enrollment_id, s])
  );

  const rows: {
    id: string;
    user_id: string;
    userName: string;
    programName: string;
    day: number;
    streak: number;
    riskScore: number;
    daysMissed: number;
    lastCheckin: string | null;
    status: string;
  }[] = [];

  const today = new Date().toISOString().slice(0, 10);

  for (const e of enrollments) {
    const streak = streakMap.get(e.id);

    const { data: riskScore } = await supabase.rpc("calculate_risk_score", {
      p_enrollment_id: e.id,
    });
    const score = typeof riskScore === "number" ? riskScore : 0;

    const lastCheckin = streak?.last_checkin_date ?? null;
    let daysMissed = 0;
    if (lastCheckin) {
      const last = new Date(lastCheckin + "T00:00:00Z");
      const t = new Date(today + "T00:00:00Z");
      daysMissed = Math.max(0, Math.round((t.getTime() - last.getTime()) / 86400000));
    } else if (e.started_at) {
      const start = new Date((e.started_at as string).slice(0, 10) + "T00:00:00Z");
      const t = new Date(today + "T00:00:00Z");
      daysMissed = Math.max(0, Math.round((t.getTime() - start.getTime()) / 86400000));
    }

    rows.push({
      id: e.id,
      user_id: e.user_id,
      userName: profileMap.get(e.user_id) ?? "–",
      programName: programMap.get(e.program_id) ?? "–",
      day: e.current_day ?? 0,
      streak: streak?.current_streak ?? 0,
      riskScore: score,
      daysMissed,
      lastCheckin,
      status: e.status,
    });
  }

  rows.sort((a, b) => b.riskScore - a.riskScore);

  return NextResponse.json({ rows });
}
