import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  const verified = await verifyAdmin();
  if (verified.error) return verified.error;

  const { searchParams } = new URL(request.url);
  const triggerReason = searchParams.get("trigger_reason") || undefined;
  const outcome = searchParams.get("outcome") || undefined;

  const supabase = createServiceClient();

  let q = supabase
    .from("rescue_interventions")
    .select(
      "id, user_id, enrollment_id, trigger_reason, risk_score_at_trigger, action_taken, outcome, outcome_at, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (triggerReason) q = q.eq("trigger_reason", triggerReason);
  if (outcome) q = q.eq("outcome", outcome);

  const { data, error } = await q;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const userIds = [...new Set((data ?? []).map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);
  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name?.trim() || p.email || "–"])
  );

  const rows = (data ?? []).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    enrollment_id: r.enrollment_id,
    userName: profileMap.get(r.user_id) ?? "–",
    trigger_reason: r.trigger_reason,
    risk_score_at_trigger: r.risk_score_at_trigger,
    action_taken: r.action_taken,
    outcome: r.outcome,
    outcome_at: r.outcome_at,
    created_at: r.created_at,
  }));

  // Outcomes breakdown
  const { data: allRescues } = await supabase
    .from("rescue_interventions")
    .select("outcome");

  const outcomes = (allRescues ?? []).reduce(
    (acc: Record<string, number>, r) => {
      const o = r.outcome ?? "pending";
      acc[o] = (acc[o] ?? 0) + 1;
      return acc;
    },
    {}
  );

  return NextResponse.json({
    rows,
    outcomes: {
      user_returned: outcomes.user_returned ?? 0,
      user_continued_light: outcomes.user_continued_light ?? 0,
      user_paused: outcomes.user_paused ?? 0,
      user_dropped: outcomes.user_dropped ?? 0,
      pending: outcomes.pending ?? 0,
    },
  });
}
