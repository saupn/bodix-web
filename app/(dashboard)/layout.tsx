import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getUserStatus, canAccessDashboard, getRedirectPath, type StatusEnrollment } from "@/lib/user/status";
import { getMyStats } from "@/lib/completion/fetch-stats";
import { getRescueStatus } from "@/lib/rescue/fetch-status";
import {
  decodeWorkoutCookie,
  isWorkoutTokenPath,
  WORKOUT_COOKIE_NAME,
} from "@/lib/workout-token";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth check with session-aware client
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Magic-link phiên tập: cookie workout-token CHỈ mở đúng 2 route workout.
    // Mọi route dashboard khác (trang chủ, hồ sơ, thanh toán…) vẫn đòi session
    // đầy đủ → token-only KHÔNG bao giờ được hiểu là "đã đăng nhập đầy đủ".
    const pathname = (await headers()).get("x-pathname") ?? "";
    if (isWorkoutTokenPath(pathname)) {
      const cookieStore = await cookies();
      const access = decodeWorkoutCookie(
        cookieStore.get(WORKOUT_COOKIE_NAME)?.value
      );
      if (access) {
        // Shell tối giản — KHÔNG có nav tới hồ sơ/thanh toán/cộng đồng.
        return (
          <div className="min-h-screen bg-neutral-50">
            <main className="mx-auto max-w-2xl px-4 py-6 pb-24">{children}</main>
          </div>
        );
      }
    }
    redirect("/login");
  }

  // Profile check with service client (bypasses RLS — same as complete-onboarding API)
  const service = createServiceClient();
  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("full_name, trial_ends_at, onboarding_completed, payment_status, bodix_program")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("[dashboard/layout] profile query error:", profileError.message, profileError.code);
  }

  // Fetch enrollments (keep using session client for RLS-protected data)
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

  const enrollments = (enrollmentsRaw ?? []) as unknown as StatusEnrollment[];

  // Debug: profile query failed — show error instead of redirecting (prevents loop)
  if (!profile) {
    return (
      <html><body>
        <div style={{padding: '2rem', fontFamily: 'monospace'}}>
          <h1>Debug: Profile not found</h1>
          <p>User ID: {user.id}</p>
          <p>Profile Error: {profileError?.message || 'No error but data is null'}</p>
          <p>Profile Error Code: {profileError?.code || 'N/A'}</p>
          <p>This means the Supabase query to profiles table returned null.</p>
          <p>Check: does a row exist in profiles with id = {user.id}?</p>
          <p><a href="/login">Go to login</a></p>
        </div>
      </body></html>
    );
  }

  // Xác định trạng thái user
  const { status: userStatus } = getUserStatus(
    {
      onboarding_completed: profile.onboarding_completed ?? false,
      trial_ends_at: profile.trial_ends_at ?? null,
    },
    enrollments
  );

  console.log("[dashboard/layout] user:", user.id, "onboarding_completed:", profile.onboarding_completed, "status:", userStatus);

  // Chưa onboard → redirect /onboarding
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
        avatar_url: null,
        trial_ends_at: profile?.trial_ends_at ?? null,
      }}
      trialStartedAt={
        enrollments.find((e) => e.status === "trial")?.started_at ?? null
      }
      userEmail={user.email ?? ""}
      userId={user.id}
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
