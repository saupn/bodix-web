import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns the user's most relevant enrollment summary for empty-state
 * messaging on /app/progress and similar pages. Picks the "current" enrollment
 * in priority order: active → paid_waiting_cohort → pending_payment →
 * trial_completed → trial → completed → none.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(
      "id, status, cohort_id, programs(slug, name), cohorts(name, start_date)",
    )
    .eq("user_id", user.id)
    .order("enrolled_at", { ascending: false });

  type Row = {
    id: string;
    status: string;
    cohort_id: string | null;
    programs: { slug: string; name: string } | { slug: string; name: string }[] | null;
    cohorts: { name: string; start_date: string } | { name: string; start_date: string }[] | null;
  };

  const rows = (enrollments ?? []) as unknown as Row[];

  const PRIORITY = [
    "active",
    "paid_waiting_cohort",
    "pending_payment",
    "trial_completed",
    "trial",
    "completed",
  ];

  let chosen: Row | null = null;
  for (const status of PRIORITY) {
    const found = rows.find((r) => r.status === status);
    if (found) {
      chosen = found;
      break;
    }
  }

  if (!chosen) {
    return NextResponse.json({ status: "no_enrollment" });
  }

  const program = Array.isArray(chosen.programs) ? chosen.programs[0] : chosen.programs;
  const cohort = Array.isArray(chosen.cohorts) ? chosen.cohorts[0] : chosen.cohorts;

  return NextResponse.json({
    status: chosen.status,
    program_slug: program?.slug ?? null,
    program_name: program?.name ?? null,
    cohort_name: cohort?.name ?? null,
    cohort_start_date: cohort?.start_date ?? null,
  });
}
