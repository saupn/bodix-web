"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const FATIGUE_EMOJIS = ["😩", "😫", "😐", "😊", "💪"];
const FATIGUE_LABELS = ["Kiệt sức", "Khá mệt", "Vừa phải", "Khỏe", "Tràn năng lượng"];

const PROGRESS_EMOJIS = ["😔", "🤔", "🙂", "😄", "🤩"];
const PROGRESS_LABELS = ["Không thấy gì", "Hơi khác", "Thấy khác", "Khác rõ", "Thay đổi lớn"];

const DIFFICULTY_LABELS = ["Quá dễ", "Dễ", "Vừa", "Khó", "Quá khó"];

const FEELING_EMOJI = (avg: number | null): string => {
  if (avg == null) return "—";
  if (avg < 1.5) return "😩";
  if (avg < 2.5) return "😫";
  if (avg < 3.5) return "😐";
  if (avg < 4.5) return "😊";
  return "💪";
};

const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const ADJUSTMENT_ICON: Record<string, string> = {
  increase: "💪",
  maintain: "✅",
  decrease: "🌿",
};

interface ContextData {
  hasEnrollment: boolean;
  enrollment_id?: string;
  week_number?: number;
  start_date?: string;
  end_date?: string;
  pending?: boolean;
  reason?: string;
  existing_review?: Record<string, unknown>;
  week_stats?: {
    completed_count: number;
    completion_rate: number;
    hard_count: number;
    light_count: number;
    recovery_count: number;
    avg_feeling: number | null;
    day_completed: boolean[];
  };
  is_review_window?: boolean;
}

export default function WeeklyReviewPage() {
  const [context, setContext] = useState<ContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    system_suggestion: string;
    intensity_adjustment: string;
  } | null>(null);

  const [fatigueLevel, setFatigueLevel] = useState<number | null>(null);
  const [progressFeeling, setProgressFeeling] = useState<number | null>(null);
  const [difficultyRating, setDifficultyRating] = useState<number | null>(null);
  const [bodyChanges, setBodyChanges] = useState("");
  const [biggestChallenge, setBiggestChallenge] = useState("");
  const [nextWeekGoal, setNextWeekGoal] = useState("");

  useEffect(() => {
    fetch("/api/reviews/weekly/context")
      .then((r) => r.json())
      .then(setContext)
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    if (
      !context?.enrollment_id ||
      !context?.week_number ||
      fatigueLevel == null ||
      progressFeeling == null ||
      difficultyRating == null
    ) {
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/reviews/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollment_id: context.enrollment_id,
          week_number: context.week_number,
          fatigue_level: fatigueLevel,
          progress_feeling: progressFeeling,
          difficulty_rating: difficultyRating,
          body_changes: bodyChanges.trim() || undefined,
          biggest_challenge: biggestChallenge.trim() || undefined,
          next_week_goal: nextWeekGoal.trim() || undefined,
        }),
      });
      const data = await r.json();
      if (r.ok) {
        setSubmitResult({
          system_suggestion: data.system_suggestion,
          intensity_adjustment: data.intensity_adjustment,
        });
        setSubmitted(true);
      } else {
        alert(data.error ?? "Lỗi gửi review.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-neutral-500">Đang tải...</p>
      </div>
    );
  }

  if (!context?.hasEnrollment) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-neutral-200 bg-white p-6 text-center">
        <p className="text-neutral-600">Bạn chưa có chương trình đang hoạt động.</p>
        <Link
          href="/app/program"
          className="mt-4 inline-block font-medium text-primary"
        >
          Xem chương trình →
        </Link>
      </div>
    );
  }

  if (context.reason === "first_week_not_complete") {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-neutral-200 bg-white p-6 text-center">
        <p className="text-neutral-600">
          Tuần đầu chưa kết thúc. Hãy tập thêm vài ngày rồi quay lại review nhé!
        </p>
        <Link
          href="/app/program"
          className="mt-4 inline-block font-medium text-primary"
        >
          Về chương trình →
        </Link>
      </div>
    );
  }

  const existing = context.existing_review as Record<string, unknown> | undefined;
  const stats = context.week_stats;
  const weekNum = context.week_number ?? 0;
  const startDate = context.start_date ?? "";
  const endDate = context.end_date ?? "";

  return (
    <div className="mx-auto max-w-2xl px-4 pb-12 pt-6">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-primary">
          📝 Review Tuần {weekNum}
        </h1>
        <p className="mt-1 text-neutral-600">
          Tuần {startDate} — {endDate}
        </p>
      </header>

      {existing ? (
        /* ─── ĐÃ SUBMIT ─── */
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-neutral-200 bg-white p-3 text-center">
              <p className="text-xs text-neutral-500">Hoàn thành</p>
              <p className="font-semibold text-primary">
                {existing.week_completion_rate != null
                  ? `${Math.round(Number(existing.week_completion_rate))}%`
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-3 text-center">
              <p className="text-xs text-neutral-500">Mode</p>
              <p className="text-sm font-medium">
                {existing.week_hard_count ?? 0}H / {existing.week_light_count ?? 0}L /{" "}
                {existing.week_recovery_count ?? 0}R
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-3 text-center">
              <p className="text-xs text-neutral-500">Cảm giác TB</p>
              <p className="text-xl">
                {FEELING_EMOJI(
                  existing.avg_feeling != null ? Number(existing.avg_feeling) : null
                )}
              </p>
            </div>
          </div>

          {existing.system_suggestion && (
            <div
              className={`rounded-xl border-2 p-4 ${
                existing.intensity_adjustment === "increase"
                  ? "border-green-300 bg-green-50"
                  : existing.intensity_adjustment === "decrease"
                    ? "border-amber-300 bg-amber-50"
                    : "border-blue-200 bg-blue-50"
              }`}
            >
              <p className="text-lg">
                {ADJUSTMENT_ICON[String(existing.intensity_adjustment) ?? ""] ?? "💡"}{" "}
                {String(existing.system_suggestion)}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h3 className="font-heading font-semibold text-primary">
              Review đã gửi
            </h3>
            <div className="mt-3 space-y-2 text-sm text-neutral-700">
              <p>
                Mệt mỏi: {FATIGUE_LABELS[(existing.fatigue_level as number) - 1]}
              </p>
              <p>
                Tiến bộ: {PROGRESS_LABELS[(existing.progress_feeling as number) - 1]}
              </p>
              <p>
                Độ khó: {DIFFICULTY_LABELS[(existing.difficulty_rating as number) - 1]}
              </p>
              {existing.body_changes && (
                <p>
                  <span className="text-neutral-500">Cơ thể:</span>{" "}
                  {String(existing.body_changes)}
                </p>
              )}
              {existing.biggest_challenge && (
                <p>
                  <span className="text-neutral-500">Thử thách:</span>{" "}
                  {String(existing.biggest_challenge)}
                </p>
              )}
              {existing.next_week_goal && (
                <p>
                  <span className="text-neutral-500">Mục tiêu:</span>{" "}
                  {String(existing.next_week_goal)}
                </p>
              )}
            </div>
          </div>

          <Link
            href="/app/review/history"
            className="inline-flex rounded-lg bg-primary px-4 py-2.5 font-medium text-white transition-colors hover:bg-primary-dark"
          >
            Xem lịch sử review
          </Link>
        </div>
      ) : (
        /* ─── CHƯA SUBMIT ─── */
        <div className="space-y-6">
          {/* Stats cards */}
          {stats && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-neutral-200 bg-white p-3 text-center">
                <p className="text-xs text-neutral-500">Hoàn thành</p>
                <p className="font-semibold text-primary">
                  {stats.completed_count}/7 ngày ({stats.completion_rate}%)
                </p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white p-3 text-center">
                <p className="text-xs text-neutral-500">Mode</p>
                <p className="text-sm font-medium">
                  {stats.hard_count}H / {stats.light_count}L / {stats.recovery_count}R
                </p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white p-3 text-center">
                <p className="text-xs text-neutral-500">Cảm giác TB</p>
                <p className="text-xl">{FEELING_EMOJI(stats.avg_feeling)}</p>
              </div>
            </div>
          )}

          {/* Mini calendar */}
          {stats?.day_completed && (
            <div className="flex gap-2">
              {DAY_LABELS.map((label, i) => (
                <div
                  key={label}
                  className="flex flex-1 flex-col items-center rounded-lg border border-neutral-200 bg-white p-2"
                >
                  <span className="text-xs text-neutral-500">{label}</span>
                  <span className="mt-1 text-lg">
                    {stats.day_completed[i] ? "✅" : "❌"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {submitted && submitResult ? (
            /* ─── Sau submit thành công ─── */
            <div className="space-y-6">
              <div
                className="rounded-xl border-2 border-green-300 bg-green-50 p-6 text-center transition-opacity"
              >
                <p className="text-lg font-medium text-green-800">
                  Cảm ơn bạn! Review giúp BodiX hiểu bạn hơn.
                </p>
              </div>
              <div
                className={`rounded-xl border-2 p-4 ${
                  submitResult.intensity_adjustment === "increase"
                    ? "border-green-300 bg-green-50"
                    : submitResult.intensity_adjustment === "decrease"
                      ? "border-amber-300 bg-amber-50"
                      : "border-blue-200 bg-blue-50"
                }`}
              >
                <p className="text-lg">
                  {ADJUSTMENT_ICON[submitResult.intensity_adjustment] ?? "💡"}{" "}
                  {submitResult.system_suggestion}
                </p>
              </div>
              <Link
                href="/app/review/history"
                className="inline-flex rounded-lg bg-primary px-4 py-2.5 font-medium text-white transition-colors hover:bg-primary-dark"
              >
                Xem lịch sử review
              </Link>
            </div>
          ) : (
            /* ─── Form ─── */
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="space-y-6 rounded-xl border border-neutral-200 bg-white p-4 sm:p-6"
            >
              {/* 1. Mệt mỏi */}
              <div>
                <p className="mb-2 font-medium text-neutral-800">
                  Mức độ mệt mỏi tuần này?
                </p>
                <p className="mb-3 text-xs text-neutral-500">
                  Kiệt sức → Tràn năng lượng
                </p>
                <div className="flex flex-wrap gap-2">
                  {FATIGUE_EMOJIS.map((emoji, i) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setFatigueLevel(i + 1)}
                      className={`flex flex-1 min-w-[3rem] flex-col items-center rounded-lg border-2 p-3 transition-colors ${
                        fatigueLevel === i + 1
                          ? "border-primary bg-primary/10"
                          : "border-neutral-200 hover:border-neutral-300"
                      }`}
                    >
                      <span className="text-2xl">{emoji}</span>
                      <span className="mt-1 text-xs">({i + 1})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Tiến bộ */}
              <div>
                <p className="mb-2 font-medium text-neutral-800">
                  Bạn có thấy tiến bộ không?
                </p>
                <p className="mb-3 text-xs text-neutral-500">
                  Không thấy gì → Thay đổi lớn
                </p>
                <div className="flex flex-wrap gap-2">
                  {PROGRESS_EMOJIS.map((emoji, i) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setProgressFeeling(i + 1)}
                      className={`flex flex-1 min-w-[3rem] flex-col items-center rounded-lg border-2 p-3 transition-colors ${
                        progressFeeling === i + 1
                          ? "border-primary bg-primary/10"
                          : "border-neutral-200 hover:border-neutral-300"
                      }`}
                    >
                      <span className="text-2xl">{emoji}</span>
                      <span className="mt-1 text-xs">({i + 1})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Độ khó */}
              <div>
                <p className="mb-3 font-medium text-neutral-800">
                  Mức độ khó của bài tập?
                </p>
                <div className="flex flex-wrap gap-2">
                  {DIFFICULTY_LABELS.map((label, i) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setDifficultyRating(i + 1)}
                      className={`rounded-lg border-2 px-3 py-2 text-sm transition-colors ${
                        difficultyRating === i + 1
                          ? "border-primary bg-primary/10 font-medium"
                          : "border-neutral-200 hover:border-neutral-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Cơ thể */}
              <div>
                <label className="mb-2 block font-medium text-neutral-800">
                  Cơ thể thay đổi gì tuần này? <span className="text-neutral-400">(tùy chọn)</span>
                </label>
                <textarea
                  value={bodyChanges}
                  onChange={(e) => setBodyChanges(e.target.value)}
                  placeholder="VD: Bụng phẳng hơn, đùi săn hơn, ngủ ngon hơn..."
                  rows={3}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>

              {/* 5. Thử thách */}
              <div>
                <label className="mb-2 block font-medium text-neutral-800">
                  Thử thách lớn nhất? <span className="text-neutral-400">(tùy chọn)</span>
                </label>
                <textarea
                  value={biggestChallenge}
                  onChange={(e) => setBiggestChallenge(e.target.value)}
                  placeholder="VD: Thiếu thời gian, mệt buổi tối, bài khó..."
                  rows={3}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>

              {/* 6. Mục tiêu */}
              <div>
                <label className="mb-2 block font-medium text-neutral-800">
                  Mục tiêu tuần tới? <span className="text-neutral-400">(tùy chọn)</span>
                </label>
                <textarea
                  value={nextWeekGoal}
                  onChange={(e) => setNextWeekGoal(e.target.value)}
                  placeholder="VD: Tập đủ 5 buổi, thử 3 buổi Hard..."
                  rows={3}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={
                  fatigueLevel == null ||
                  progressFeeling == null ||
                  difficultyRating == null ||
                  submitting
                }
                className="w-full rounded-lg bg-primary py-3 font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
              >
                {submitting ? "Đang gửi..." : "Gửi review"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
