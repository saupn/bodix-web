/**
 * Tính "ngày chương trình" và tuần hiện tại – dùng chung cho
 * /api/program/active và trang chủ dashboard (server).
 */
export interface ProgramDayInput {
  currentDay: number | null;
  durationDays: number;
  cohortStartDate: string | null;
  cohortEndDate: string | null;
}

export interface ProgramDayResult {
  programDay: number;
  cohortNotStarted: boolean;
  cohortActive: boolean;
  weekDays: number[];
}

export function computeProgramDay({
  currentDay,
  durationDays,
  cohortStartDate,
  cohortEndDate,
}: ProgramDayInput): ProgramDayResult {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = cohortStartDate ? new Date(cohortStartDate) : null;
  const endDate = cohortEndDate ? new Date(cohortEndDate) : null;

  let programDay = currentDay ?? 0;
  if (cohortStartDate) {
    const start = new Date(cohortStartDate);
    start.setHours(0, 0, 0, 0);
    const diff = Math.floor(
      (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    const computedDay = Math.min(Math.max(1, diff + 1), durationDays);
    if (diff >= 0) {
      programDay = Math.max(currentDay ?? 0, computedDay);
    }
  }

  const cohortNotStarted = !!startDate && today < startDate;
  let cohortActive =
    !!startDate && !!endDate && today >= startDate && today <= endDate;
  if (!cohortNotStarted && !cohortActive && programDay > 0) {
    cohortActive = true;
  }

  const weekSize = 7;
  const currentWeek = programDay > 0 ? Math.ceil(programDay / weekSize) : 1;
  const weekStartDay = (currentWeek - 1) * weekSize + 1;
  const weekDays = Array.from(
    { length: Math.min(weekSize, durationDays - weekStartDay + 1) },
    (_, i) => weekStartDay + i
  ).filter((d) => d >= 1 && d <= durationDays);

  return { programDay, cohortNotStarted, cohortActive, weekDays };
}
