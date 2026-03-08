"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StreakBadge } from "@/components/completion/StreakBadge";
import { ProgressRing } from "@/components/completion/ProgressRing";
import { WeeklyCalendar } from "@/components/completion/WeeklyCalendar";
import type { CheckinData } from "@/components/completion/WeeklyCalendar";
import { MILESTONE_CONFIG } from "@/lib/completion/milestones";
import { ComebackCard } from "@/components/rescue/ComebackCard";

const COMEBACK_DISMISSED_KEY = "comeback-dismissed";

function isComebackRecent(achievedAt: string): boolean {
  const t = new Date(achievedAt).getTime();
  const now = Date.now();
  return now - t < 24 * 60 * 60 * 1000;
}

const WORKOUT_TYPE_LABEL: Record<string, string> = {
  main: "Chính",
  recovery: "Recovery",
  flexible: "Linh hoạt",
};

interface ProgramActive {
  program_day: number;
  total_days: number;
  today_workout: {
    day_number: number;
    title: string;
    duration_minutes: number;
    workout_type: string;
  } | null;
  today_completed: boolean;
  today_completed_mode: string | null;
  week_days: number[];
}

interface MyStats {
  enrollment_id: string;
  cohort_id: string | null;
  current_day: number;
  total_days: number;
  streak: { current_streak: number; longest_streak: number; total_completed_days: number };
  completion_rate: number;
  milestones: { milestone_type: string; achieved_at: string }[];
  checkins?: { day_number: number; mode: string }[];
}

interface CohortBoard {
  stats: { completed_today: number; total_members: number };
}

interface HistoryData {
  start_date: string;
  days: CheckinData[];
}

export function DashboardHomeContent({
  displayName,
}: {
  displayName: string;
}) {
  const [program, setProgram] = useState<ProgramActive | null>(null);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [cohort, setCohort] = useState<CohortBoard | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [comebackDismissed, setComebackDismissed] = useState<string | null>(null);
  const [reviewPending, setReviewPending] = useState<{
    pending: boolean;
    week_number?: number;
    message?: string;
  } | null>(null);
  const [communitySummary, setCommunitySummary] = useState<{
    count: number;
    new_in_7d: number;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [progRes, statsRes, pendingRes] = await Promise.all([
          fetch("/api/program/active"),
          fetch("/api/completion/my-stats"),
          fetch("/api/reviews/weekly/pending"),
        ]);

        if (!progRes.ok || !statsRes.ok) {
          setLoading(false);
          return;
        }

        const [prog, st] = await Promise.all([progRes.json(), statsRes.json()]);
        setProgram(prog);
        setStats(st);

        if (pendingRes.ok) {
          const pendingData = await pendingRes.json();
          if (pendingData.pending) setReviewPending(pendingData);
        }

        const cm = st.milestones?.find((m) => m.milestone_type === "comeback");
        if (cm && isComebackRecent(cm.achieved_at)) {
          try {
            const d = sessionStorage.getItem(COMEBACK_DISMISSED_KEY);
            if (d === cm.achieved_at) setComebackDismissed(d);
          } catch {
            /* ignore */
          }
        }

        if (st.cohort_id) {
          const [cohortRes, communityRes] = await Promise.all([
            fetch(`/api/completion/cohort-board?cohort_id=${st.cohort_id}`),
            fetch(`/api/community/posts/summary?cohort_id=${st.cohort_id}`),
          ]);
          if (cohortRes.ok) {
            const c = await cohortRes.json();
            setCohort(c);
          }
          if (communityRes.ok) {
            const cm = await communityRes.json();
            setCommunitySummary({ count: cm.count ?? 0, new_in_7d: cm.new_in_7d ?? 0 });
          }
        }

        if (st.enrollment_id) {
          const histRes = await fetch(
            `/api/completion/history?enrollment_id=${st.enrollment_id}`
          );
          if (histRes.ok) {
            const h = await histRes.json();
            setHistory(h);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading || !program || !stats) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-neutral-500">Đang tải...</p>
      </div>
    );
  }

  const recentMilestones = stats.milestones.slice(-3).reverse();
  const programDay = program.program_day ?? stats.current_day;
  const comebackMilestone = stats.milestones.find(
    (m) => m.milestone_type === "comeback"
  );
  const showComeback =
    comebackMilestone &&
    isComebackRecent(comebackMilestone.achieved_at) &&
    comebackDismissed !== comebackMilestone.achieved_at;

  const handleComebackDismiss = () => {
    if (!comebackMilestone) return;
    try {
      sessionStorage.setItem(
        COMEBACK_DISMISSED_KEY,
        comebackMilestone.achieved_at
      );
      setComebackDismissed(comebackMilestone.achieved_at);
    } catch {
      setComebackDismissed(comebackMilestone.achieved_at);
    }
  };

  const todayCompleted =
    program.today_completed ??
    (stats.checkins?.some((c) => c.day_number === programDay) ?? false);
  const todayMode =
    program.today_completed_mode ??
    stats.checkins?.find((c) => c.day_number === programDay)?.mode;

  return (
    <div className="space-y-6">
      {/* Header + StreakBadge compact */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
          Xin chào, {displayName}!
        </h1>
        <StreakBadge
          currentStreak={stats.streak.current_streak}
          longestStreak={stats.streak.longest_streak}
          compact
        />
      </div>

      {/* Review pending card — Chủ nhật/Thứ 2 */}
      {reviewPending?.pending && (
        <Link
          href="/app/review/weekly"
          className="block rounded-xl border-2 border-amber-300 bg-amber-50 p-4 transition-colors hover:border-amber-400 hover:bg-amber-100"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📝</span>
              <div>
                <p className="font-medium text-amber-900">
                  Review tuần {reviewPending.week_number} đang chờ bạn
                </p>
                <p className="text-sm text-amber-700">
                  {reviewPending.message ?? "Dành 2 phút review tuần vừa qua nhé!"}
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-lg bg-amber-200 px-4 py-2 font-medium text-amber-900">
              Review ngay
            </span>
          </div>
        </Link>
      )}

      {/* Comeback card — khi vừa comeback (milestone trong 24h gần nhất) */}
      {showComeback && (
        <ComebackCard
          programDay={programDay}
          currentStreak={stats.streak.current_streak || 1}
          onDismiss={handleComebackDismiss}
        />
      )}

      {/* Bài tập hôm nay — hiện khi không showComeback hoặc đã dismiss */}
      {program.today_workout && !showComeback && (
        <Link
          href={`/app/program/workout/${programDay}`}
          className="block rounded-xl border-2 border-primary/30 bg-primary/5 p-6 transition-colors hover:border-primary/50 hover:bg-primary/10"
        >
          <h2 className="font-heading text-xl font-semibold text-primary">
            Bài tập hôm nay
          </h2>
          <p className="mt-2 font-medium text-neutral-800">
            Ngày {programDay} — {program.today_workout.title}
          </p>
          <div className="mt-2 flex gap-2 text-sm text-neutral-600">
            <span>{program.today_workout.duration_minutes} phút</span>
            <span>
              {WORKOUT_TYPE_LABEL[program.today_workout.workout_type] ??
                program.today_workout.workout_type}
            </span>
          </div>
          {todayCompleted ? (
            <p className="mt-4 flex items-center gap-2 text-success font-medium">
              ✓ Đã hoàn thành
              {todayMode && (
                <span className="text-neutral-600">({todayMode})</span>
              )}
            </p>
          ) : (
            <span className="mt-4 inline-block font-medium text-primary">
              Bắt đầu tập →
            </span>
          )}
        </Link>
      )}

      {/* ProgressRing + WeeklyCalendar row */}
      <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
        <div className="flex justify-center sm:justify-start">
          <ProgressRing
            completedDays={stats.streak.total_completed_days}
            totalDays={stats.total_days}
            rate={stats.completion_rate}
          />
        </div>
        {history && (
          <div className="min-w-0">
            <WeeklyCalendar
              checkins={history.days}
              startDate={history.start_date}
              currentDay={programDay}
              totalDays={stats.total_days}
            />
          </div>
        )}
      </div>

      {/* Cohort card */}
      {stats.cohort_id && (
        <Link
          href="/app/community"
          className="block rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-colors hover:border-primary/30 hover:shadow-md"
        >
          <h3 className="font-heading font-semibold text-primary">
            👥 Cohort
          </h3>
          <p className="mt-2 text-sm text-neutral-600">
            {cohort
              ? `${cohort.stats.completed_today}/${cohort.stats.total_members} người đã tập hôm nay`
              : "Xem bảng hoàn thành"}
          </p>
          <span className="mt-2 inline-block text-sm font-medium text-primary">
            Xem bảng hoàn thành →
          </span>
        </Link>
      )}

      {/* Community card — bài viết mới trong đợt tập */}
      {stats.cohort_id && (
        <Link
          href="/app/community?tab=feed"
          className="block rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-colors hover:border-primary/30 hover:shadow-md"
        >
          <h3 className="font-heading font-semibold text-primary">
            👥 Cộng đồng
          </h3>
          <p className="mt-2 text-sm text-neutral-600">
            {communitySummary
              ? communitySummary.count === 0
                ? "Chưa có bài viết nào. Hãy chia sẻ đầu tiên!"
                : `${communitySummary.count} bài viết trong đợt tập`
              : "Xem bảng tin"}
          </p>
          <span className="mt-2 inline-block rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            Xem bảng tin
          </span>
        </Link>
      )}

      {/* Milestones gần nhất */}
      {recentMilestones.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h3 className="font-heading text-sm font-semibold text-primary">
            Thành tích gần đây
          </h3>
          <ul className="mt-3 space-y-2">
            {recentMilestones.map((m) => {
              const config = MILESTONE_CONFIG[m.milestone_type];
              if (!config) return null;
              return (
                <li
                  key={m.milestone_type}
                  className="flex items-center gap-2 text-sm"
                >
                  <span>{config.emoji}</span>
                  <span className="text-neutral-700">{config.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
