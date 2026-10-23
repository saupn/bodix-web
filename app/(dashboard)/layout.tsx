import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardSessionProvider } from "@/components/dashboard/DashboardSessionContext";
import { getUserStatus, canAccessDashboard, getRedirectPath } from "@/lib/user/status";
import { getStreakSummary } from "@/lib/completion/fetch-stats";
import { getRescueStatusForEnrollment } from "@/lib/rescue/fetch-status";
import {
  getAuthUser,
  getDashboardEnrollments,
  getDashboardProfile,
  getRequestSupabase,
} from "@/lib/dashboard/session";
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
  // Auth check – getAuthUser() dùng chung với page trong cùng request (React cache).
  const user = await getAuthUser();

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

  // Profile (service client, lọc theo id) và enrollments (session client, RLS)
  // chạy song song. Page bên dưới gọi lại 2 hàm này sẽ dùng chung kết quả.
  const [{ profile, error: profileError }, enrollments] = await Promise.all([
    getDashboardProfile(user.id),
    getDashboardEnrollments(user.id),
  ]);

  if (profileError) {
    console.error("[dashboard/layout] profile query error:", profileError.message, profileError.code);
  }

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
  // Badge streak + banner rescue: chỉ cần enrollment active → 1 lượt song song.
  const activeEnrollment = hasActiveProgram
    ? enrollments.find((e) => e.status === "active") ?? null
    : null;
  const supabase = await getRequestSupabase();
  const [streak, rescueStatus] = activeEnrollment
    ? await Promise.all([
        getStreakSummary(supabase, activeEnrollment.id),
        getRescueStatusForEnrollment(supabase, activeEnrollment.id),
      ])
    : [null, null];
  const myStats = activeEnrollment && streak
    ? { streak, current_day: activeEnrollment.current_day ?? 0 }
    : null;

  // Id phiên cho các tab client (bỏ một đợt gọi /api/program/active).
  const sessionEnrollment = enrollments.find((e) => e.status === "active") ?? null;
  const session = {
    userId: user.id,
    activeEnrollment: sessionEnrollment
      ? {
          id: sessionEnrollment.id,
          cohortId: sessionEnrollment.cohort_id,
          programId: sessionEnrollment.program_id,
        }
      : null,
  };

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
      isAdmin={profile.role === "admin"}
      hasActiveProgram={hasActiveProgram}
      hideProgramsLink={!!sessionEnrollment}
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
      <DashboardSessionProvider value={session}>{children}</DashboardSessionProvider>
    </DashboardShell>
  );
}
