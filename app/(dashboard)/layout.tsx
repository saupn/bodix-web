import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  getUserStatus,
  getRedirectPath,
  canAccessDashboard,
  type StatusEnrollment,
} from "@/lib/user/status";
import { getMyStats } from "@/lib/completion/fetch-stats";
import { getRescueStatus } from "@/lib/rescue/fetch-status";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch profile (bao gồm onboarding_completed để phân loại status)
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, trial_ends_at, onboarding_completed")
    .eq("id", user.id)
    .single();

  // Fetch enrollments đang hoạt động (bỏ qua dropped)
  const { data: enrollmentsRaw } = await supabase
    .from("enrollments")
    .select(
      `id, status, program_id, cohort_id, started_at, completed_at,
       program:programs (slug, name),
       cohort:cohorts (status, start_date)`
    )
    .eq("user_id", user.id)
    .not("status", "eq", "dropped")
    .order("enrolled_at", { ascending: false });

  const enrollments = (enrollmentsRaw ?? []) as StatusEnrollment[];

  // Xác định trạng thái user
  const { status: userStatus, activeEnrollment } = getUserStatus(
    profile
      ? {
          onboarding_completed: profile.onboarding_completed,
          trial_ends_at: profile.trial_ends_at,
        }
      : null,
    enrollments
  );

  // Redirect nếu chưa qua onboarding
  if (!canAccessDashboard(userStatus)) {
    redirect(getRedirectPath(userStatus));
  }

  const hasActiveProgram =
    userStatus === "active_program" || userStatus === "waiting_cohort";
  const myStats = hasActiveProgram ? await getMyStats(supabase) : null;
  const rescueStatus = hasActiveProgram ? await getRescueStatus(supabase) : null;

  return (
    <DashboardShell
      profile={{
        full_name: profile?.full_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        trial_ends_at: profile?.trial_ends_at ?? null,
      }}
      userEmail={user.email ?? ""}
      userId={user.id}
      userStatus={userStatus}
      activeEnrollment={activeEnrollment}
      hasActiveProgram={hasActiveProgram}
      streak={
        myStats
          ? {
              current: myStats.streak.current_streak,
              longest: myStats.streak.longest_streak,
            }
          : null
      }
      rescue={
        rescueStatus?.is_in_rescue && rescueStatus.current_intervention
          ? {
              riskLevel: rescueStatus.risk_level,
              suggestedMode: rescueStatus.suggested_mode,
              programDay: myStats?.current_day ?? 1,
              completedDays: myStats?.streak.total_completed_days ?? 0,
              lightDuration: 20,
              recoveryDuration: 15,
              interventionId: rescueStatus.current_intervention.id,
            }
          : null
      }
    >
      {children}
    </DashboardShell>
  );
}
