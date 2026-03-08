import type { SupabaseClient } from "@supabase/supabase-js";

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type SuggestedMode = "hard" | "light" | "recovery";

function toRiskLevel(score: number): RiskLevel {
  if (score <= 20) return "low";
  if (score <= 50) return "medium";
  if (score <= 80) return "high";
  return "critical";
}

function toSuggestedMode(score: number): SuggestedMode {
  if (score < 30) return "hard";
  if (score <= 60) return "light";
  return "recovery";
}

export interface RescueStatusData {
  is_in_rescue: boolean;
  current_intervention: {
    id: string;
    trigger_reason: string;
    action_taken: string;
    created_at: string;
    message_sent: string | null;
  } | null;
  risk_score: number;
  risk_level: RiskLevel;
  suggested_mode: SuggestedMode;
  days_missed: number;
}

export async function getRescueStatus(
  supabase: SupabaseClient
): Promise<RescueStatusData | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (enrollmentError || !enrollment) return null;

  const [streakResult, riskResult, interventionsResult] = await Promise.all([
    supabase
      .from("streaks")
      .select("last_checkin_date")
      .eq("enrollment_id", enrollment.id)
      .maybeSingle(),
    supabase.rpc("calculate_risk_score", {
      p_enrollment_id: enrollment.id,
    }),
    supabase
      .from("rescue_interventions")
      .select("id, trigger_reason, action_taken, created_at, message_sent, outcome")
      .eq("enrollment_id", enrollment.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const riskScore: number =
    typeof riskResult.data === "number" ? riskResult.data : 0;
  const lastCheckinDate = streakResult.data?.last_checkin_date ?? null;
  const interventions = interventionsResult.data ?? [];

  const currentIntervention = interventions.find(
    (i: { outcome: string }) => i.outcome === "pending"
  ) ?? null;

  function daysMissed(last: string | null): number {
    if (!last) return 0;
    const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
    const lastDate = new Date(last + "T00:00:00Z");
    return Math.max(
      0,
      Math.round((today.getTime() - lastDate.getTime()) / 86400000)
    );
  }

  return {
    is_in_rescue: currentIntervention !== null,
    current_intervention: currentIntervention
      ? {
          id: currentIntervention.id,
          trigger_reason: currentIntervention.trigger_reason,
          action_taken: currentIntervention.action_taken,
          created_at: currentIntervention.created_at,
          message_sent: currentIntervention.message_sent ?? null,
        }
      : null,
    risk_score: riskScore,
    risk_level: toRiskLevel(riskScore),
    suggested_mode: toSuggestedMode(riskScore),
    days_missed: daysMissed(lastCheckinDate),
  };
}
