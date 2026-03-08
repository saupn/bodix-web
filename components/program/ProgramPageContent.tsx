"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronUp, Lock, Camera } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { StreakBadge } from "@/components/completion/StreakBadge";
import { ProgressRing } from "@/components/completion/ProgressRing";
import { WeeklyCalendar } from "@/components/completion/WeeklyCalendar";
import type { CheckinData } from "@/components/completion/WeeklyCalendar";
import { MILESTONE_CONFIG } from "@/lib/completion/milestones";

interface Workout {
  id: string;
  day_number: number;
  title: string;
  duration_minutes: number;
  workout_type: string;
}

interface ProgramData {
  enrollment: { id?: string; current_day: number };
  program: { name: string; duration_days: number };
  cohort: { name: string; start_date: string; end_date: string } | null;
  program_day: number;
  total_days: number;
  cohort_not_started: boolean;
  cohort_active: boolean;
  today_workout: Workout | null;
  week_days: number[];
  workouts: Workout[];
  completed_days: number[];
  today_completed: boolean;
  today_completed_mode: string | null;
}

const WORKOUT_TYPE_LABEL: Record<string, string> = {
  main: "Chính",
  recovery: "Recovery",
  review: "Review",
  flexible: "Linh hoạt",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function useCountdown(targetDate: string | null) {
  const [diff, setDiff] = useState<{ days: number; hours: number } | null>(null);

  useEffect(() => {
    if (!targetDate) {
      setDiff(null);
      return;
    }
    const update = () => {
      const end = new Date(targetDate).setHours(0, 0, 0, 0);
      const now = Date.now();
      const d = end - now;
      if (d <= 0) {
        setDiff({ days: 0, hours: 0 });
        return;
      }
      setDiff({
        days: Math.floor(d / (1000 * 60 * 60 * 24)),
        hours: Math.floor((d % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      });
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [targetDate]);

  return diff;
}

export function ProgramPageContent() {
  const router = useRouter();
  const [data, setData] = useState<ProgramData | null>(null);
  const [stats, setStats] = useState<{
    streak: { current_streak: number; longest_streak: number; total_completed_days: number };
    completion_rate: number;
    milestones: { milestone_type: string }[];
  } | null>(null);
  const [history, setHistory] = useState<{ start_date: string; days: CheckinData[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [prepChecks, setPrepChecks] = useState({
    beforePhoto: false,
    nutrition: false,
    equipment: false,
  });
  const [weekExpanded, setWeekExpanded] = useState(true);
  const [selectedMode, setSelectedMode] = useState<"hard" | "light" | "recovery">("hard");
  const [rescue, setRescue] = useState<{
    is_in_rescue: boolean;
    suggested_mode: "hard" | "light" | "recovery";
  } | null>(null);
  const [progressTrend, setProgressTrend] = useState<
    { week: string; value: number }[]
  >([]);

  const countdown = useCountdown(
    data?.cohort_not_started && data?.cohort ? data.cohort.start_date : null
  );

  useEffect(() => {
    const load = async () => {
      try {
        const progRes = await fetch("/api/program/active");
        if (!progRes.ok) {
          if (progRes.status === 404) router.replace("/app");
          throw new Error("Failed");
        }
        const prog = await progRes.json();
        setData(prog);

        const enrollmentId = prog.enrollment?.id;
        const [statsRes, histRes, rescueRes, reviewsRes] = await Promise.all([
          fetch("/api/completion/my-stats"),
          enrollmentId
            ? fetch(`/api/completion/history?enrollment_id=${enrollmentId}`)
            : null,
          fetch("/api/rescue/status"),
          enrollmentId
            ? fetch(`/api/reviews/weekly?enrollment_id=${enrollmentId}`)
            : null,
        ]);

        if (rescueRes.ok) {
          const r = await rescueRes.json();
          if (r.is_in_rescue && r.suggested_mode) {
            setRescue({ is_in_rescue: true, suggested_mode: r.suggested_mode });
            setSelectedMode(r.suggested_mode);
          }
        }

        if (statsRes.ok) {
          const s = await statsRes.json();
          setStats(s);
        }
        if (histRes?.ok) {
          const h = await histRes.json();
          setHistory(h);
        }
        if (reviewsRes?.ok) {
          const r = await reviewsRes.json();
          const trend = (r.trend?.progress_trend ?? []).map(
            (t: { week: number; value: number }) => ({
              week: `Tuần ${t.week}`,
              value: t.value,
            })
          );
          setProgressTrend(trend);
        }
      } catch {
        router.replace("/app");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  if (loading || !data) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-neutral-500">Đang tải...</p>
      </div>
    );
  }

  const { program, cohort, program_day, total_days } = data;
  const cohortName = cohort?.name ?? "Đợt sắp tới";

  const getDayStatus = (day: number) => {
    const histDay = history?.days?.find((d) => d.day_number === day);
    if (histDay?.status === "completed") return "done";
    if (histDay?.status === "today") return "today";
    if (histDay?.status === "missed") return "missed";
    if (day === program_day) return "today";
    if (data.completed_days.includes(day)) return "done";
    if (day < program_day) return "missed";
    return "upcoming";
  };

  const achievedTypes = new Set(stats?.milestones?.map((m) => m.milestone_type) ?? []);
  const allMilestoneTypes = Object.keys(MILESTONE_CONFIG);

  const getWorkoutForDay = (day: number) =>
    data.workouts.find((w) => w.day_number === day);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
          {program.name} — {cohortName}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="h-2 flex-1 min-w-[120px] max-w-xs overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${Math.min(100, (program_day / total_days) * 100)}%`,
              }}
            />
          </div>
          <span className="text-sm font-medium text-neutral-600">
            Ngày {program_day}/{total_days}
          </span>
        </div>
        {/* StreakBadge full + ProgressRing */}
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {stats && (
            <StreakBadge
              currentStreak={stats.streak.current_streak}
              longestStreak={stats.streak.longest_streak}
              compact={false}
            />
          )}
          {stats && (
            <div className="sm:ml-auto">
              <ProgressRing
                completedDays={stats.streak.total_completed_days}
                totalDays={total_days}
                rate={stats.completion_rate}
              />
            </div>
          )}
        </div>
      </div>

      {/* Cohort not started */}
      {data.cohort_not_started && cohort && (
        <div className="space-y-6 rounded-xl border-2 border-primary/20 bg-primary/5 p-6">
          <h2 className="font-heading text-lg font-semibold text-primary">
            Đợt tập bắt đầu sau {countdown?.days ?? 0} ngày {countdown?.hours ?? 0} giờ
          </h2>

          <div className="space-y-3">
            <p className="text-sm font-medium text-neutral-700">
              Chuẩn bị trước khi bắt đầu:
            </p>
            {[
              { key: "beforePhoto", label: "Tải ảnh before (tùy chọn)" },
              { key: "nutrition", label: "Đọc hướng dẫn dinh dưỡng" },
              { key: "equipment", label: "Chuẩn bị dụng cụ tập" },
            ].map(({ key, label }) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3"
              >
                <input
                  type="checkbox"
                  checked={prepChecks[key as keyof typeof prepChecks]}
                  onChange={(e) =>
                    setPrepChecks((p) => ({ ...p, [key]: e.target.checked }))
                  }
                  className="h-4 w-4 rounded text-primary"
                />
                <span className="text-neutral-700">{label}</span>
              </label>
            ))}
          </div>

          <p className="text-primary font-medium">
            Sắp bắt đầu rồi! Hẹn gặp bạn vào {formatDate(cohort.start_date)}.
          </p>
        </div>
      )}

      {/* Cohort active */}
      {data.cohort_active && (
        <>
          {/* Sunday Review card */}
          {data.today_workout?.workout_type === "review" && !data.today_completed && (
            <div className="rounded-xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-white p-6 shadow-md">
              <div className="flex items-center gap-3">
                <span className="text-3xl">☀️</span>
                <div>
                  <h2 className="font-heading text-xl font-bold text-primary">
                    Review Chủ nhật
                  </h2>
                  <p className="text-sm text-neutral-500">~25 phút</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-neutral-600">
                Xem lại tuần qua, lắng nghe cơ thể, và chuẩn bị cho tuần mới.
              </p>
              <Link
                href="/app/program/review"
                className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2.5 font-medium text-secondary-light transition-colors hover:bg-primary-dark"
              >
                Bắt đầu Review
              </Link>
            </div>
          )}

          {/* Today's workout card */}
          {data.today_workout && data.today_workout.workout_type !== "review" && (
            <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-6 shadow-md">
              <h2 className="font-heading text-xl font-bold text-primary">
                Ngày {program_day} — {data.today_workout.title}
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="text-sm text-accent">
                  {data.today_workout.duration_minutes} phút
                </span>
                <span className="text-sm text-neutral-500">
                  {WORKOUT_TYPE_LABEL[data.today_workout.workout_type] ??
                    data.today_workout.workout_type}
                </span>
              </div>

              {!data.today_completed ? (
                <>
                  <div className="mt-4 flex gap-2">
                    {["hard", "light", "recovery"].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() =>
                          setSelectedMode(m as "hard" | "light" | "recovery")
                        }
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                          selectedMode === m
                            ? "bg-primary text-secondary-light"
                            : "bg-neutral-200 text-neutral-600 hover:bg-neutral-300"
                        }`}
                      >
                        {m === "hard" ? "Hard" : m === "light" ? "Light" : "Recovery"}
                      </button>
                    ))}
                  </div>
                  {rescue?.is_in_rescue && (
                    <p className="mt-2 text-sm text-neutral-500">
                      Gợi ý: {rescue.suggested_mode} mode cho hôm nay
                    </p>
                  )}
                  <Link
                    href={
                      rescue?.is_in_rescue
                        ? `/app/program/workout/${program_day}?mode=${selectedMode}`
                        : `/app/program/workout/${program_day}`
                    }
                    className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2.5 font-medium text-secondary-light transition-colors hover:bg-primary-dark"
                  >
                    Bắt đầu tập
                  </Link>
                </>
              ) : (
                <p className="mt-4 flex items-center gap-2 text-success font-medium">
                  ✓ Đã hoàn thành
                  {data.today_completed_mode && (
                    <span className="text-neutral-600">
                      ({data.today_completed_mode})
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Today completed — review type */}
          {data.today_workout?.workout_type === "review" && data.today_completed && (
            <div className="rounded-xl border-2 border-purple-200 bg-purple-50/50 p-6">
              <div className="flex items-center gap-3">
                <span className="text-3xl">☀️</span>
                <div>
                  <h2 className="font-heading text-lg font-semibold text-primary">
                    Review Chủ nhật
                  </h2>
                  <p className="mt-1 flex items-center gap-2 text-success font-medium">
                    ✓ Đã hoàn thành
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* WeeklyCalendar from history */}
          {history && (
            <WeeklyCalendar
              checkins={history.days}
              startDate={history.start_date}
              currentDay={program_day}
              totalDays={total_days}
            />
          )}

          {/* Tiến bộ qua các tuần — sparkline */}
          {progressTrend.length > 0 && (
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <h3 className="font-heading font-semibold text-primary">
                Tiến bộ qua các tuần
              </h3>
              <div className="mt-3 h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progressTrend}>
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                    <YAxis domain={[1, 5]} hide />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="value"
                      name="Cảm nhận tiến bộ"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Week's workout list */}
          <div className="rounded-xl border border-neutral-200 bg-white">
            <button
              type="button"
              onClick={() => setWeekExpanded(!weekExpanded)}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <h3 className="font-heading font-semibold text-primary">
                Bài tập tuần này
              </h3>
              {weekExpanded ? (
                <ChevronUp className="h-5 w-5 text-neutral-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-neutral-500" />
              )}
            </button>
            {weekExpanded && (
              <div className="border-t border-neutral-100">
                {data.week_days.map((day) => {
                  const workout = getWorkoutForDay(day);
                  const status = getDayStatus(day);
                  const statusLabel =
                    status === "done"
                      ? "Hoàn thành"
                      : status === "today"
                      ? "Hôm nay"
                      : status === "missed"
                      ? "Bỏ lỡ"
                      : "Sắp tới";
                  return (
                    <div
                      key={day}
                      className="flex items-center justify-between border-b border-neutral-50 px-4 py-3 last:border-0"
                    >
                      <div>
                        <span className="font-medium text-neutral-800">
                          Ngày {day}
                        </span>
                        {workout && (
                          <>
                            <p className="text-sm text-neutral-600">
                              {workout.title}
                            </p>
                            <p className="text-xs text-accent">
                              {workout.duration_minutes} phút
                            </p>
                          </>
                        )}
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          status === "done"
                            ? "bg-success/20 text-success"
                            : status === "today"
                            ? "bg-primary/20 text-primary"
                            : status === "missed"
                            ? "bg-accent/20 text-accent"
                            : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Thành tích — milestones grid */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold text-primary">
                Thành tích
              </h3>
              {data.enrollment?.id && (
                <Link
                  href="/app/photos"
                  className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  <Camera className="h-4 w-4" />
                  Upload ảnh tiến bộ
                </Link>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {allMilestoneTypes.map((type) => {
                const config = MILESTONE_CONFIG[type];
                const achieved = achievedTypes.has(type);
                if (!config) return null;
                return (
                  <div
                    key={type}
                    className={`flex flex-col items-center rounded-lg border p-3 text-center ${
                      achieved
                        ? "border-primary/30 bg-primary/5"
                        : "border-neutral-200 bg-neutral-50/50 opacity-60"
                    }`}
                  >
                    <span className="flex h-8 items-center justify-center text-2xl">
                      {achieved ? (
                        config.emoji
                      ) : (
                        <Lock className="h-5 w-5 text-neutral-400" />
                      )}
                    </span>
                    <span
                      className={`mt-1 text-xs font-medium ${
                        achieved ? "text-primary" : "text-neutral-500"
                      }`}
                    >
                      {config.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
