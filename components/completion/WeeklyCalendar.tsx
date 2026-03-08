"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type DayStatus =
  | "completed"
  | "missed"
  | "upcoming"
  | "today"
  | "rest_day";

export interface CheckinData {
  day_number: number;
  date: string;
  status: DayStatus;
  mode: string | null;
  feeling: number | null;
}

const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const MODE_ICON: Record<string, string> = {
  hard: "💪",
  light: "🌿",
  recovery: "🧘",
  skip: "⏭",
};

interface WeeklyCalendarProps {
  checkins: CheckinData[];
  startDate: string;
  currentDay: number;
  totalDays: number;
}

function getDayForWeek(week: number, cellIndex: number): number {
  return (week - 1) * 7 + cellIndex + 1;
}

export function WeeklyCalendar({
  checkins,
  startDate,
  currentDay,
  totalDays,
}: WeeklyCalendarProps) {
  const totalWeeks = Math.ceil(totalDays / 7);
  const [week, setWeek] = useState(() => Math.ceil(currentDay / 7) || 1);

  const checkinByDay = new Map(checkins.map((c) => [c.day_number, c]));

  const canPrev = week > 1;
  const canNext = week < totalWeeks;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-heading text-base font-semibold text-primary">
          Tuần {week}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setWeek((w) => Math.max(1, w - 1))}
            disabled={!canPrev}
            className="rounded-lg p-2 text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent"
            aria-label="Tuần trước"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setWeek((w) => Math.min(totalWeeks, w + 1))}
            disabled={!canNext}
            className="rounded-lg p-2 text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent"
            aria-label="Tuần sau"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {DAY_LABELS.map((label, i) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1 text-center"
          >
            <span className="text-xs font-medium text-neutral-500">{label}</span>
            <DayCell
              dayNumber={getDayForWeek(week, i)}
              totalDays={totalDays}
              data={checkinByDay.get(getDayForWeek(week, i))}
              isCurrentDay={getDayForWeek(week, i) === currentDay}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface DayCellProps {
  dayNumber: number;
  totalDays: number;
  data: CheckinData | undefined;
  isCurrentDay: boolean;
}

function DayCell({ dayNumber, totalDays, data, isCurrentDay }: DayCellProps) {
  if (dayNumber > totalDays) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100/50 text-neutral-300 sm:h-12 sm:w-12">
        —
      </div>
    );
  }

  const status = data?.status ?? (isCurrentDay ? "today" : "upcoming");

  if (status === "completed" && data) {
    const icon = data.mode ? MODE_ICON[data.mode] ?? "✓" : "✓";
    return (
      <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-success/20 text-success sm:h-12 sm:w-12">
        <span className="text-lg">{icon}</span>
        <span className="text-[10px] font-medium">{dayNumber}</span>
      </div>
    );
  }

  if (status === "rest_day") {
    return (
      <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-neutral-100 text-neutral-400 sm:h-12 sm:w-12">
        <span className="text-lg">😴</span>
        <span className="text-[10px] font-medium">{dayNumber}</span>
      </div>
    );
  }

  if (status === "missed") {
    return (
      <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-red-50 text-red-400 sm:h-12 sm:w-12">
        <span className="text-lg">✗</span>
        <span className="text-[10px] font-medium">{dayNumber}</span>
      </div>
    );
  }

  if (status === "today") {
    return (
      <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg border-2 border-primary bg-primary/5 animate-pulse-subtle sm:h-12 sm:w-12">
        <span className="text-sm font-semibold text-primary">{dayNumber}</span>
      </div>
    );
  }

  // upcoming
  return (
    <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-neutral-100 text-neutral-400 sm:h-12 sm:w-12">
      <span className="text-[10px] font-medium">{dayNumber}</span>
    </div>
  );
}
