/**
 * Dữ liệu trang chủ dashboard cho user đang có enrollment active.
 * Trước đây client gọi 7 API qua 4 đợt nối tiếp (~28 query); giờ server lấy
 * tất cả trong MỘT đợt song song, dùng enrollment đã có từ layout.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCohortStats,
  getHistoryForEnrollment,
  getMyStatsForEnrollment,
  type HistoryDay,
  type MyStatsData,
} from "@/lib/completion/fetch-stats";
import { computeProgramDay } from "@/lib/program/day";
import { getWeeklyReviewPending } from "@/lib/reviews/weekly-pending";
import type { DashboardEnrollment } from "@/lib/dashboard/session";

export interface HomeTodayWorkout {
  day_number: number;
  title: string;
  duration_minutes: number;
  workout_type: string;
}

export interface HomeData {
  programDay: number;
  totalDays: number;
  todayWorkout: HomeTodayWorkout | null;
  todayCompleted: boolean;
  todayMode: string | null;
  stats: MyStatsData;
  history: { start_date: string; days: HistoryDay[] } | null;
  cohortStats: { completed_today: number; total_members: number } | null;
  communityPostCount: number | null;
  reviewPending: { week_number: number; message: string } | null;
  creditBalance: number;
}

export async function getHomeData(
  supabase: SupabaseClient,
  userId: string,
  enrollment: DashboardEnrollment
): Promise<HomeData> {
  const program = enrollment.program ?? {
    slug: "",
    name: "",
    duration_days: 21,
  };
  const { programDay } = computeProgramDay({
    currentDay: enrollment.current_day,
    durationDays: program.duration_days,
    cohortStartDate: enrollment.cohort?.start_date ?? null,
    cohortEndDate: enrollment.cohort?.end_date ?? null,
  });

  const [
    stats,
    workoutResult,
    history,
    cohortStats,
    postsResult,
    reviewPending,
    creditsResult,
  ] = await Promise.all([
    getMyStatsForEnrollment(supabase, {
      id: enrollment.id,
      current_day: enrollment.current_day,
      cohort_id: enrollment.cohort_id,
      program: { name: program.name, duration_days: program.duration_days },
    }),
    supabase
      .from("workout_templates")
      .select("day_number, title, duration_minutes, workout_type")
      .eq("program_id", enrollment.program_id)
      .eq("day_number", programDay)
      .maybeSingle(),
    getHistoryForEnrollment(supabase, {
      id: enrollment.id,
      started_at: enrollment.started_at,
      program_id: enrollment.program_id,
      duration_days: program.duration_days,
    }),
    enrollment.cohort_id
      ? getCohortStats(supabase, enrollment.cohort_id)
      : Promise.resolve(null),
    enrollment.cohort_id
      ? supabase
          .from("community_posts")
          .select("id", { count: "exact", head: true })
          .eq("cohort_id", enrollment.cohort_id)
          .eq("is_hidden", false)
      : Promise.resolve({ count: null }),
    getWeeklyReviewPending(supabase, enrollment).catch((err) => {
      console.error("[home-data] weekly pending:", err);
      return null;
    }),
    supabase.from("user_credits").select("amount").eq("user_id", userId),
  ]);

  // Trước đây API trả today_completed:false cứng → luôn hiện "Bắt đầu tập".
  // Giờ suy ra từ check-in của ngày hiện tại.
  const todayCheckin = stats.checkins.find((c) => c.day_number === programDay);

  return {
    programDay,
    totalDays: program.duration_days,
    todayWorkout: (workoutResult.data as HomeTodayWorkout | null) ?? null,
    todayCompleted: !!todayCheckin,
    todayMode: todayCheckin?.mode ?? null,
    stats,
    history,
    cohortStats,
    communityPostCount: postsResult.count ?? null,
    reviewPending:
      reviewPending && reviewPending.pending
        ? { week_number: reviewPending.week_number, message: reviewPending.message }
        : null,
    creditBalance: (creditsResult.data ?? []).reduce(
      (sum, row: { amount: number | null }) => sum + (row.amount ?? 0),
      0
    ),
  };
}
