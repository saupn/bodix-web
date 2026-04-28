import {
  calendarDaysBetween,
  getVietnamDateString,
  isoTimestampToVietnamYmd,
} from "@/lib/date/vietnam";
import { TRIAL_DAYS } from "@/lib/trial/utils";

/**
 * Trạng thái hiển thị trial — pure function dùng cho cả server và client.
 *
 * KHÔNG dùng `enrollment.current_day` từ DB — DB current_day có thể bị lệch
 * (cron chưa update, check-in chưa sync). Tính từ `started_at` so với hôm nay
 * theo lịch Asia/Ho_Chi_Minh.
 *
 * KHÔNG dùng `Date.setHours(0,0,0,0)` — `setHours` chạy theo timezone của môi
 * trường (UTC trên Vercel, ICT trên browser VN) nên cho ra kết quả lệch nhau
 * giữa SSR và client.
 */

export type TrialDisplayStatus = {
  hasStarted: boolean;
  currentDay: number; // 0 nếu chưa bắt đầu, 1-3 trong trial, >3 đã hết
  totalDays: number; // = TRIAL_DAYS
  daysRemaining: number; // = max(0, totalDays - currentDay)
  isEnded: boolean; // currentDay > totalDays
  headingText: string;
  subtextTop: string;
  daysRemainingText: string; // "" nếu không hiển thị
  showWorkoutCard: boolean;
  progressPercent: number; // 0-100
};

const NOT_STARTED: TrialDisplayStatus = {
  hasStarted: false,
  currentDay: 0,
  totalDays: TRIAL_DAYS,
  daysRemaining: TRIAL_DAYS,
  isEnded: false,
  headingText: "Trải nghiệm thử",
  subtextTop:
    "Bắt đầu từ ngày mai. Sáng mai lúc 6:30 bạn sẽ nhận tin nhắc tập đầu tiên qua Zalo.",
  daysRemainingText: "Bạn có 3 ngày trải nghiệm",
  showWorkoutCard: false,
  progressPercent: 0,
};

/**
 * @param input.started_at ISO timestamp (e.g. "2026-04-28T00:00:00+07:00") hoặc YYYY-MM-DD
 */
export function getTrialDisplayStatus(input: {
  started_at: string | null | undefined;
}): TrialDisplayStatus {
  const raw = input.started_at;
  if (!raw) return NOT_STARTED;

  // Accept both ISO timestamp and YYYY-MM-DD.
  const startYmd = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? raw
    : isoTimestampToVietnamYmd(raw);
  const todayYmd = getVietnamDateString();
  const daysPassed = calendarDaysBetween(startYmd, todayYmd);

  if (daysPassed < 0) return NOT_STARTED;

  const currentDay = daysPassed + 1; // ngày start = ngày 1

  if (currentDay > TRIAL_DAYS) {
    return {
      hasStarted: true,
      currentDay,
      totalDays: TRIAL_DAYS,
      daysRemaining: 0,
      isEnded: true,
      headingText: "Trải nghiệm thử đã kết thúc",
      subtextTop: "Chờ thông báo từ BodiX!",
      daysRemainingText: "",
      showWorkoutCard: false,
      progressPercent: 100,
    };
  }

  const daysRemaining = Math.max(0, TRIAL_DAYS - currentDay);

  return {
    hasStarted: true,
    currentDay,
    totalDays: TRIAL_DAYS,
    daysRemaining,
    isEnded: false,
    headingText: `Đang trải nghiệm thử – Ngày ${currentDay}/${TRIAL_DAYS}`,
    subtextTop: "Xem bài tập hôm nay.",
    daysRemainingText:
      daysRemaining > 0
        ? `Hoặc tiếp tục trải nghiệm, còn ${daysRemaining} ngày`
        : "Hôm nay là ngày cuối trải nghiệm",
    showWorkoutCard: true,
    progressPercent: Math.round((currentDay / TRIAL_DAYS) * 100),
  };
}
