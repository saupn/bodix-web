"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { MILESTONE_CONFIG } from "@/lib/completion/milestones";

interface StreakData {
  current_streak: number;
  longest_streak: number;
  total_completed_days: number;
  total_hard_days: number;
  total_light_days: number;
  total_recovery_days: number;
  total_skip_days: number;
}

interface StatsData {
  enrollment_id: string;
  program_name: string;
  current_day: number;
  total_days: number;
  completion_rate: number;
  streak: StreakData;
  checkins: { day_number: number; mode: string; feeling: number | null }[];
  milestones: { milestone_type: string; achieved_at: string }[];
}

interface HistoryDay {
  day_number: number;
  date: string;
  status: "completed" | "missed" | "upcoming" | "today" | "rest_day";
  mode: string | null;
  feeling: number | null;
}

const MODE_EMOJI: Record<string, string> = {
  hard: "💪",
  light: "🌿",
  easy: "☀️",
  recovery: "🧘",
  review: "📝",
};

export default function ProgressPage() {
  const router = useRouter();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [history, setHistory] = useState<HistoryDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const statsRes = await fetch("/api/completion/my-stats");
        if (!statsRes.ok) {
          if (statsRes.status === 404) {
            router.replace("/app");
          }
          return;
        }
        const s: StatsData = await statsRes.json();
        setStats(s);

        const histRes = await fetch(
          `/api/completion/history?enrollment_id=${s.enrollment_id}`
        );
        if (histRes.ok) {
          const h = await histRes.json();
          setHistory(h.days ?? []);
        }
      } catch {
        router.replace("/app");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  if (loading || !stats) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-neutral-600">Đang tải...</p>
      </div>
    );
  }

  const { streak, milestones } = stats;
  const progressPct = Math.min(
    100,
    stats.total_days > 0
      ? (stats.current_day / stats.total_days) * 100
      : 0
  );

  // Intensity breakdown — count from checkins for easy/review modes
  // since streaks table only tracks hard/light/recovery/skip
  const easyCount = stats.checkins.filter((c) => c.mode === "easy").length;
  const reviewCount = stats.checkins.filter((c) => c.mode === "review").length;

  const achievedTypes = new Set(milestones.map((m) => m.milestone_type));
  const allMilestoneTypes = Object.keys(MILESTONE_CONFIG);

  // Calendar: group by weeks (7 columns)
  const weeks: HistoryDay[][] = [];
  for (let i = 0; i < history.length; i += 7) {
    weeks.push(history.slice(i, i + 7));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-8">
      {/* Section 1 — Tổng quan */}
      <section>
        <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
          {stats.program_name}
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Ngày {stats.current_day}/{stats.total_days} –{" "}
          <span className="font-medium text-primary">
            {stats.completion_rate}% hoàn thành
          </span>
        </p>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </section>

      {/* Section 2 — Streak */}
      <section className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center">
          <p className="text-3xl font-bold text-primary">
            🔥 {streak.current_streak}
          </p>
          <p className="mt-1 text-sm text-neutral-600">Streak hiện tại</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
          <p className="text-3xl font-bold text-amber-700">
            ⭐ {streak.longest_streak}
          </p>
          <p className="mt-1 text-sm text-neutral-600">Dài nhất</p>
        </div>
      </section>

      {/* Section 3 — Phân bổ cường độ */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="font-heading text-base font-semibold text-primary mb-4">
          Phân bổ cường độ
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { emoji: "💪", label: "Hard", count: streak.total_hard_days },
            { emoji: "🌿", label: "Light", count: streak.total_light_days },
            { emoji: "☀️", label: "Easy", count: easyCount },
            { emoji: "🧘", label: "Phục hồi", count: streak.total_recovery_days },
            { emoji: "📝", label: "Review", count: reviewCount },
          ].map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center rounded-lg border border-neutral-100 bg-neutral-50/50 p-3"
            >
              <span className="text-xl">{item.emoji}</span>
              <span className="mt-1 text-lg font-bold text-neutral-800">
                {item.count}
              </span>
              <span className="text-xs text-neutral-600">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4 — Lịch tập */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="font-heading text-base font-semibold text-primary mb-4">
          Lịch tập
        </h2>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d) => (
            <div
              key={d}
              className="text-center text-[10px] font-medium text-neutral-600"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="space-y-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((day) => {
                let cellClass =
                  "flex h-9 w-full items-center justify-center rounded-md text-xs font-medium transition-colors";
                let content: string = String(day.day_number);
                const modeEmoji = day.mode ? MODE_EMOJI[day.mode] : null;

                if (day.status === "completed") {
                  cellClass += " bg-green-100 text-green-700";
                  content = modeEmoji ?? "✓";
                } else if (day.status === "missed") {
                  cellClass += " bg-red-50 text-red-400";
                  content = "✗";
                } else if (day.status === "today") {
                  cellClass +=
                    " border-2 border-primary bg-primary/5 text-primary font-bold";
                } else if (day.status === "rest_day") {
                  cellClass += " bg-neutral-50 text-neutral-300";
                  content = "–";
                } else {
                  // upcoming
                  cellClass += " bg-neutral-50 text-neutral-300";
                }

                return (
                  <div key={day.day_number} className={cellClass} title={`Ngày ${day.day_number}`}>
                    {content}
                  </div>
                );
              })}
              {/* Pad last week if less than 7 days */}
              {week.length < 7 &&
                Array.from({ length: 7 - week.length }).map((_, i) => (
                  <div key={`pad-${i}`} className="h-9" />
                ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-neutral-600">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-green-100" /> Hoàn thành
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-red-50 border border-red-200" /> Bỏ lỡ
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded border-2 border-primary" /> Hôm nay
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-neutral-50" /> Sắp tới
          </span>
        </div>
      </section>

      {/* Section 5 — Thành tích */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="font-heading text-base font-semibold text-primary mb-4">
          Thành tích
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {allMilestoneTypes.map((type) => {
            const config = MILESTONE_CONFIG[type];
            if (!config) return null;
            const achieved = achievedTypes.has(type);
            return (
              <div
                key={type}
                className={`flex flex-col items-center rounded-lg border p-4 text-center transition-all ${
                  achieved
                    ? "border-primary/30 bg-primary/5"
                    : "border-neutral-200 bg-neutral-50/50 opacity-50"
                }`}
              >
                <span className="flex h-10 items-center justify-center text-2xl">
                  {achieved ? config.emoji : <Lock className="h-5 w-5 text-neutral-600" />}
                </span>
                <span
                  className={`mt-2 text-xs font-medium leading-tight ${
                    achieved ? "text-primary" : "text-neutral-600"
                  }`}
                >
                  {config.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Back link */}
      <Link
        href="/app/program"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        ← Quay lại chương trình
      </Link>
    </div>
  );
}
