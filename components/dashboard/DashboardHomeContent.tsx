"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { StreakBadge } from "@/components/completion/StreakBadge";
import { ProgressRing } from "@/components/completion/ProgressRing";
import { WeeklyCalendar } from "@/components/completion/WeeklyCalendar";
import { MILESTONE_CONFIG } from "@/lib/completion/milestones";
import { ComebackCard } from "@/components/rescue/ComebackCard";
import { BuddyCard } from "@/components/dashboard/BuddyCard";
import { ZaloConnectBanner } from "@/components/dashboard/ZaloConnectBanner";
import { GiftBookCard } from "@/components/dashboard/GiftBookCard";
import type { HomeData } from "@/lib/dashboard/home-data";

const COMEBACK_DISMISSED_KEY = "comeback-dismissed";

const subscribeNoop = () => () => {};
function readDismissed(): string | null {
  try {
    return sessionStorage.getItem(COMEBACK_DISMISSED_KEY);
  } catch {
    return null;
  }
}

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

/** Khung chờ trong lúc server lấy dữ liệu trang chủ (Suspense fallback). */
export function DashboardHomeSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true">
      <div className="flex items-center justify-between gap-4">
        <div className="h-8 w-48 rounded-lg bg-neutral-200" />
        <div className="h-8 w-20 rounded-full bg-neutral-200" />
      </div>
      <div className="h-36 rounded-xl border-2 border-neutral-200 bg-white" />
      <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
        <div className="mx-auto h-32 w-32 rounded-full bg-neutral-200 sm:mx-0" />
        <div className="h-32 rounded-xl bg-neutral-200" />
      </div>
      <div className="h-20 rounded-xl border border-neutral-200 bg-white" />
    </div>
  );
}

export function DashboardHomeContent({
  displayName,
  phoneVerified = true,
  data,
}: {
  displayName: string;
  phoneVerified?: boolean;
  data: HomeData;
}) {
  // sessionStorage chỉ có ở client: server snapshot = null, client đọc giá trị thật.
  const storedDismissed = useSyncExternalStore(
    subscribeNoop,
    readDismissed,
    () => null
  );
  const [dismissedNow, setComebackDismissed] = useState<string | null>(null);
  const comebackDismissed = dismissedNow ?? storedDismissed;

  const { stats, history, programDay } = data;
  const comebackMilestone = stats.milestones.find(
    (m) => m.milestone_type === "comeback"
  );

  const recentMilestones = stats.milestones.slice(-3).reverse();
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

  return (
    <div className="space-y-6">
      {/* Zalo connect banner */}
      <ZaloConnectBanner phoneVerified={phoneVerified} />

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

      <GiftBookCard />

      {/* Voucher/credit card */}
      {data.creditBalance > 0 && (
        <Link
          href="/app/profile"
          className="block rounded-xl border border-amber-200 bg-amber-50 p-4 transition-colors hover:border-amber-300 hover:bg-amber-100"
        >
          <p className="font-medium text-amber-900">
            🎁 Bạn có {data.creditBalance.toLocaleString("vi-VN")}đ voucher
          </p>
          <span className="mt-1 inline-block text-sm text-amber-800">
            Xem chi tiết →
          </span>
        </Link>
      )}

      {/* Review pending card — Chủ nhật/Thứ 2 */}
      {data.reviewPending && (
        <Link
          href="/app/review/weekly"
          className="block rounded-xl border-2 border-amber-300 bg-amber-50 p-4 transition-colors hover:border-amber-400 hover:bg-amber-100"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📝</span>
              <div>
                <p className="font-medium text-amber-900">
                  Tổng kết tuần {data.reviewPending.week_number} đang chờ bạn
                </p>
                <p className="text-sm text-amber-700">
                  {data.reviewPending.message ?? "Dành 2 phút tổng kết tuần vừa qua nhé!"}
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-lg bg-amber-200 px-4 py-2 font-medium text-amber-900">
              Tổng kết ngay
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
      {data.todayWorkout && !showComeback && (
        <Link
          href={`/app/program/workout/${programDay}`}
          className="block rounded-xl border-2 border-primary/30 bg-primary/5 p-6 transition-colors hover:border-primary/50 hover:bg-primary/10"
        >
          <h2 className="font-heading text-xl font-semibold text-primary">
            Bài tập hôm nay
          </h2>
          <p className="mt-2 font-medium text-neutral-800">
            Ngày {programDay} – {data.todayWorkout.title}
          </p>
          <div className="mt-2 flex gap-2 text-sm text-neutral-600">
            <span>{data.todayWorkout.duration_minutes} phút</span>
            <span>
              {WORKOUT_TYPE_LABEL[data.todayWorkout.workout_type] ??
                data.todayWorkout.workout_type}
            </span>
          </div>
          {data.todayCompleted ? (
            <p className="mt-4 flex items-center gap-2 text-success font-medium">
              ✓ Đã hoàn thành
              {data.todayMode && (
                <span className="text-neutral-600">({data.todayMode})</span>
              )}
            </p>
          ) : (
            <span className="mt-4 inline-block font-medium text-primary">
              Bắt đầu tập →
            </span>
          )}
        </Link>
      )}

      {/* Buddy card */}
      <BuddyCard />

      {/* ProgressRing + WeeklyCalendar row */}
      <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
        <div className="flex justify-center sm:justify-start">
          <ProgressRing
            completedDays={stats.streak.total_completed_days}
            totalDays={data.totalDays}
            rate={stats.completion_rate}
          />
        </div>
        {history && (
          <div className="min-w-0">
            <WeeklyCalendar
              checkins={history.days}
              startDate={history.start_date}
              currentDay={programDay}
              totalDays={data.totalDays}
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
            {data.cohortStats
              ? `${data.cohortStats.completed_today}/${data.cohortStats.total_members} người đã tập hôm nay`
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
            {data.communityPostCount !== null
              ? data.communityPostCount === 0
                ? "Chưa có bài viết nào. Hãy chia sẻ đầu tiên!"
                : `${data.communityPostCount} bài viết trong đợt tập`
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
