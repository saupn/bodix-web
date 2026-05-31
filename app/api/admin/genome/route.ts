import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { getVietnamDateString } from "@/lib/date/vietnam";

/**
 * GET /api/admin/genome — tầng đọc cho dropout genome v1 (admin-only).
 *
 * Đọc enrollment_daily (snapshot do pg_cron 'genome-daily' ghi) + cohorts/
 * enrollments. Service role (bypass RLS) — verifyAdmin chặn non-admin.
 *
 * Mirror các query trong scripts/genome_analysis_queries.sql (1, 2, 3) nhưng
 * tổng hợp ở JS để không phụ thuộc thêm view/hàm DB.
 *
 * Pre-push: nếu bảng enrollment_daily chưa tồn tại (migration 062 chưa push),
 * trả genome_ready=false + section rỗng thay vì 500.
 */
export async function GET() {
  const verified = await verifyAdmin();
  if ("error" in verified) return verified.error;

  const service = createServiceClient();
  const todayVN = getVietnamDateString();

  // ── Genome sections (cần enrollment_daily) ────────────────────────────────
  let genomeReady = true;

  // Query 1 nguyên liệu: program_day + checked_in cho đường cong sống sót & cliff
  const { data: edRows, error: edErr } = await service
    .from("enrollment_daily")
    .select("program_day, checked_in")
    .not("program_day", "is", null);

  if (edErr) genomeReady = false;

  // a) Đường cong sống sót + b) dropout cliff (delta so với ngày liền trước)
  type SurvivalRow = {
    program_day: number;
    total: number;
    did_checkin: number;
    checkin_pct: number;
    delta_vs_prev_day: number | null;
  };
  const survival: SurvivalRow[] = [];
  if (genomeReady && edRows) {
    const byDay = new Map<number, { total: number; did: number }>();
    for (const r of edRows as { program_day: number; checked_in: boolean }[]) {
      const k = r.program_day;
      const cur = byDay.get(k) ?? { total: 0, did: 0 };
      cur.total += 1;
      if (r.checked_in) cur.did += 1;
      byDay.set(k, cur);
    }
    const days = [...byDay.keys()].sort((a, b) => a - b);
    let prevPct: number | null = null;
    for (const d of days) {
      const { total, did } = byDay.get(d)!;
      const pct = total > 0 ? Math.round((1000 * did) / total) / 10 : 0;
      survival.push({
        program_day: d,
        total,
        did_checkin: did,
        checkin_pct: pct,
        delta_vs_prev_day: prevPct === null ? null : Math.round((pct - prevPct) * 10) / 10,
      });
      prevPct = pct;
    }
  }

  // c) Danh sách high-risk hôm nay (VN)
  type HighRiskRow = {
    user_id: string;
    full_name: string;
    program_day: number | null;
    consecutive_missed: number;
    feeling: number | null;
    risk_score: number;
    on_rescue: boolean;
    recent_avg_feeling: number | null;
    recent_all_light: boolean;
  };
  const highRisk: HighRiskRow[] = [];
  if (genomeReady) {
    const { data: hr } = await service
      .from("enrollment_daily")
      .select("user_id, program_day, consecutive_missed, feeling, risk_score, on_rescue, recent_avg_feeling, recent_all_light")
      .eq("snapshot_date", todayVN)
      .eq("risk_band", "high")
      .order("risk_score", { ascending: false })
      .limit(200);

    const userIds = [...new Set((hr ?? []).map((r) => r.user_id).filter(Boolean))] as string[];
    const nameMap = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await service
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      for (const p of profs ?? []) nameMap.set(p.id, (p.full_name ?? "").trim());
    }
    for (const r of hr ?? []) {
      highRisk.push({
        user_id: r.user_id,
        full_name: nameMap.get(r.user_id) || "Ẩn danh",
        program_day: r.program_day,
        consecutive_missed: r.consecutive_missed ?? 0,
        feeling: r.feeling,
        risk_score: r.risk_score ?? 0,
        on_rescue: !!r.on_rescue,
        recent_avg_feeling: r.recent_avg_feeling,
        recent_all_light: !!r.recent_all_light,
      });
    }
  }

  // d) Completion rate theo cohort (luôn có — không phụ thuộc genome table)
  type CohortRow = {
    cohort_id: string;
    name: string;
    slug: string | null;
    start_date: string | null;
    enrolled: number;
    completed: number;
    completion_pct: number;
  };
  const cohortCompletion: CohortRow[] = [];
  const [{ data: cohorts }, { data: programs }, { data: enrolls }] = await Promise.all([
    service.from("cohorts").select("id, name, start_date, program_id").order("start_date", { ascending: false }),
    service.from("programs").select("id, slug"),
    service.from("enrollments").select("cohort_id, status").not("cohort_id", "is", null),
  ]);

  const slugMap = new Map<string, string>((programs ?? []).map((p) => [p.id, p.slug]));
  const tally = new Map<string, { enrolled: number; completed: number }>();
  for (const e of enrolls ?? []) {
    const k = e.cohort_id as string;
    const cur = tally.get(k) ?? { enrolled: 0, completed: 0 };
    cur.enrolled += 1;
    if (e.status === "completed") cur.completed += 1;
    tally.set(k, cur);
  }
  for (const c of cohorts ?? []) {
    const t = tally.get(c.id) ?? { enrolled: 0, completed: 0 };
    cohortCompletion.push({
      cohort_id: c.id,
      name: c.name,
      slug: slugMap.get(c.program_id) ?? null,
      start_date: c.start_date,
      enrolled: t.enrolled,
      completed: t.completed,
      completion_pct: t.enrolled > 0 ? Math.round((1000 * t.completed) / t.enrolled) / 10 : 0,
    });
  }

  return NextResponse.json(
    {
      genome_ready: genomeReady,
      today_vn: todayVN,
      survival,
      cliff: survival.map((s) => ({ program_day: s.program_day, checkin_pct: s.checkin_pct, delta_vs_prev_day: s.delta_vs_prev_day })),
      high_risk_today: highRisk,
      cohort_completion: cohortCompletion,
    },
    { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=60" } },
  );
}
