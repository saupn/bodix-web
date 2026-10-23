import type { SupabaseClient } from "@supabase/supabase-js";

export type WeeklyPendingResult =
  | { pending: true; week_number: number; message: string }
  | { pending: false; reason: string; week_number?: number };

/**
 * Tổng kết tuần có đang chờ không (chỉ Chủ nhật/Thứ 2 giờ VN).
 * Dùng chung cho /api/reviews/weekly/pending và trang chủ dashboard.
 * Ném lỗi khi query weekly_reviews lỗi (route trả 500).
 */
export async function getWeeklyReviewPending(
  supabase: SupabaseClient,
  enrollment: { id: string; current_day: number | null }
): Promise<WeeklyPendingResult> {
  // ICT = UTC + 7h — shift now to ICT to get the correct day-of-week
  const ictNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const ictDay = ictNow.getUTCDay(); // 0 = Sunday, 1 = Monday

  if (ictDay !== 0 && ictDay !== 1) {
    return { pending: false, reason: "not_review_window" };
  }

  // completedWeeks = full weeks where all 7 days have passed relative to current_day
  const completedWeeks = Math.floor((enrollment.current_day ?? 0) / 7);

  if (completedWeeks < 1) {
    return { pending: false, reason: "first_week_not_complete" };
  }

  const { data: existing, error } = await supabase
    .from("weekly_reviews")
    .select("id, submitted_at")
    .eq("enrollment_id", enrollment.id)
    .eq("week_number", completedWeeks)
    .maybeSingle();

  if (error) throw error;

  if (existing) {
    return {
      pending: false,
      reason: "already_submitted",
      week_number: completedWeeks,
    };
  }

  return {
    pending: true,
    week_number: completedWeeks,
    message: `Tuần ${completedWeeks} vừa kết thúc. Hãy dành 2 phút review nhé!`,
  };
}
