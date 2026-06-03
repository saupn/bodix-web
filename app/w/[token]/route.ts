import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  verifyWorkoutToken,
  encodeWorkoutCookie,
  workoutCookieOptions,
  WORKOUT_COOKIE_NAME,
} from "@/lib/workout-token";
import {
  TRIAL_ACCESSIBLE_STATUSES,
  TRIAL_DAYS,
  canAccessTrialContent,
} from "@/lib/trial/utils";
import { resolveTrialStartDate, getCurrentTrialDay } from "@/lib/trial/status";
import {
  calendarDaysBetween,
  getVietnamDateString,
  isoTimestampToVietnamYmd,
} from "@/lib/date/vietnam";

export const dynamic = "force-dynamic";

/**
 * Magic-link phiên tập: /w/[token]
 *  1. Verify token (DB, service). Sai/hết hạn → /login?reason=expired_workout_link.
 *  2. Set cookie SIGNED scoped (httpOnly, Secure, SameSite=Lax) — KHÔNG raw token.
 *  3. Resolve phiên tập HÔM NAY (active → /app/program/workout/N; trial → /app/trial/workout/N).
 *  4. Redirect thẳng + Referrer-Policy: no-referrer (chống rò token qua Referer).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const origin = request.nextUrl.origin;

  const redirectTo = (path: string) => {
    const res = NextResponse.redirect(new URL(path, origin));
    // Chống rò token qua Referer header khi trang đích load tài nguyên ngoài.
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  };

  const verified = await verifyWorkoutToken(token);
  if (!verified) {
    return redirectTo("/login?reason=expired_workout_link");
  }

  const userId = verified.user_id;
  const expSeconds = Math.floor(new Date(verified.expires_at).getTime() / 1000);
  const target = await resolveTodayWorkoutPath(userId);

  const res = redirectTo(target);
  res.cookies.set(
    WORKOUT_COOKIE_NAME,
    encodeWorkoutCookie(userId, expSeconds),
    workoutCookieOptions(expSeconds)
  );
  return res;
}

/**
 * Resolve route phiên tập hôm nay cho user (giống logic cron morning + API).
 * Active ưu tiên; sau đó trial-accessible; cuối cùng fallback /app.
 */
async function resolveTodayWorkoutPath(userId: string): Promise<string> {
  const service = createServiceClient();
  const todayVN = getVietnamDateString();

  const { data: profile } = await service
    .from("profiles")
    .select("bodix_start_date, trial_started_at, trial_ends_at")
    .eq("id", userId)
    .maybeSingle();

  // ── Active enrollment ──
  const { data: active } = await service
    .from("enrollments")
    .select(
      "id, program_id, started_at, enrolled_at, cohort_id, programs(duration_days), cohorts(start_date)"
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .order("enrolled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (active) {
    const cohort = active.cohorts as unknown as { start_date?: string } | null;
    const startAnchor =
      cohort?.start_date ??
      isoTimestampToVietnamYmd(active.started_at ?? active.enrolled_at);
    const duration =
      (active.programs as unknown as { duration_days?: number } | null)
        ?.duration_days ?? 21;
    let day = calendarDaysBetween(startAnchor, todayVN) + 1;
    day = Math.min(Math.max(1, day), duration);
    return `/app/program/workout/${day}`;
  }

  // ── Trial-accessible enrollment ──
  const { data: trialEn } = await service
    .from("enrollments")
    .select("id, status, started_at, enrolled_at")
    .eq("user_id", userId)
    .in("status", Array.from(TRIAL_ACCESSIBLE_STATUSES))
    .order("enrolled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    trialEn &&
    canAccessTrialContent({
      status: trialEn.status,
      trial_ends_at: profile?.trial_ends_at ?? null,
    })
  ) {
    const startDate = resolveTrialStartDate({
      bodix_start_date: profile?.bodix_start_date ?? null,
      started_at: trialEn.started_at,
      trial_started_at: profile?.trial_started_at ?? null,
      enrolled_at: trialEn.enrolled_at,
    });
    let day = getCurrentTrialDay(startDate);
    if (day < 1) day = 1;
    if (day > TRIAL_DAYS) day = TRIAL_DAYS; // trial đã hết → mở ngày cuối để xem lại
    return `/app/trial/workout/${day}`;
  }

  // Không có enrollment phù hợp → về dashboard (sẽ tự điều hướng theo state).
  return "/app";
}
