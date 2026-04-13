import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getUserStatus, canAccessDashboard, getRedirectPath, type StatusEnrollment } from "@/lib/user/status";
import { getMyStats } from "@/lib/completion/fetch-stats";
import { getRescueStatus } from "@/lib/rescue/fetch-status";

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
    redirect("/login");
  }

  // Profile check with service client (bypasses RLS — same as complete-onboarding API)
  const service = createServiceClient();
  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("full_name, trial_ends_at, onboarding_completed, payment_status, bodix_program, referral_code, gift_remaining, gift_total")
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

  // Check if user is an affiliate (for nav menu)
  const { data: affiliateProfile } = await service
    .from("affiliate_profiles")
    .select("id, is_approved")
    .eq("user_id", user.id)
    .eq("is_approved", true)
    .maybeSingle();
  const isAffiliate = !!affiliateProfile;

  // Gift section: fallback — nếu profile.referral_code null, kiểm tra referral_codes table
  // (user cũ có thể đã tạo code qua /api/referral/code trước khi profiles.referral_code được backfill)
  let referralCode: string | null = profile.referral_code ?? null;
  if (!referralCode) {
    const { data: existingRef } = await service
      .from("referral_codes")
      .select("code")
      .eq("user_id", user.id)
      .eq("code_type", "referral")
      .maybeSingle();
    if (existingRef?.code) {
      referralCode = existingRef.code;
      await service
        .from("profiles")
        .update({ referral_code: existingRef.code })
        .eq("id", user.id);
    }
  }

  const showUnpaidBanner =
    profile?.onboarding_completed === true &&
    profile?.payment_status !== "paid";

  return (
    <DashboardShell
      giftSection={
        referralCode
          ? (profile.gift_remaining ?? 10) <= 0
            ? {
                kind: "exhausted" as const,
                total: profile.gift_total ?? 10,
                referralCode,
                baseUrl: process.env.NEXT_PUBLIC_APP_URL || "https://bodix.fit",
              }
            : {
                kind: "active" as const,
                remaining: profile.gift_remaining ?? 10,
                total: profile.gift_total ?? 10,
                referralCode,
                baseUrl: process.env.NEXT_PUBLIC_APP_URL || "https://bodix.fit",
              }
          : {
              kind: "need_code" as const,
              fullName: profile.full_name ?? null,
            }
      }
      unpaidBanner={
        showUnpaidBanner ? (
          <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-medium text-amber-900">
              Hoàn tất thanh toán để bắt đầu chương trình
            </p>
            <a
              href={`/checkout?program=${profile?.bodix_program || "bodix21"}`}
              className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
              Thanh toán ngay →
            </a>
          </div>
        ) : null
      }
      profile={{
        full_name: profile?.full_name ?? null,
        avatar_url: null,
        trial_ends_at: profile?.trial_ends_at ?? null,
      }}
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
      isAffiliate={isAffiliate}
    >
      {children}
    </DashboardShell>
  );
}
