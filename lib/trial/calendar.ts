import { getVietnamDateString } from "@/lib/date/vietnam";
import { TRIAL_CONTENT_DAY_LIMIT } from "@/lib/trial/utils";

/**
 * Ngày trải nghiệm 1–3 trong trial (theo bodix_start_date), hoặc 0 nếu chưa tới ngày bắt đầu.
 */
export function getTrialExperienceDay(bodixStartDate: string | null | undefined): number {
  /** Legacy enrollment: chưa có bodix_start_date → coi như đã mở đủ 3 ngày tập thử */
  if (!bodixStartDate) return 3;
  const today = getVietnamDateString();
  if (today < bodixStartDate) return 0;
  const [ty, tm, td] = today.split("-").map(Number);
  const [sy, sm, sd] = bodixStartDate.split("-").map(Number);
  const t0 = Date.UTC(ty, tm - 1, td);
  const s0 = Date.UTC(sy, sm - 1, sd);
  const diffDays = Math.floor((t0 - s0) / 86400000);
  const day = diffDays + 1;
  return Math.min(TRIAL_CONTENT_DAY_LIMIT, Math.max(0, day));
}
