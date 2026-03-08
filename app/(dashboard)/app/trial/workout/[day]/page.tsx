"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Play } from "lucide-react";

type Exercise = {
  name: string;
  sets?: number;
  reps?: number;
  duration_seconds?: number;
};

type VersionData = {
  video_url?: string | null;
  exercises?: Exercise[];
};

interface Workout {
  id: string;
  day_number: number;
  title: string;
  description: string | null;
  duration_minutes: number;
  workout_type: string;
  hard_version: VersionData | null;
  light_version: VersionData | null;
  recovery_version: VersionData | null;
}

function Confetti() {
  const colors = ["#2D4A3E", "#C4785A", "#7CB083", "#E8DFD0"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={i}
          className="absolute h-2 w-2 animate-confetti-fall rounded-full opacity-80"
          style={{
            left: `${(i * 4) % 100}%`,
            top: "-10px",
            backgroundColor: colors[i % colors.length],
            animationDelay: `${i * 50}ms`,
            transform: `rotate(${i * 15}deg)`,
          }}
        />
      ))}
    </div>
  );
}

const WORKOUT_TYPE_LABEL: Record<string, string> = {
  main: "Main",
  recovery: "Recovery",
  flexible: "Linh hoạt",
};

type TabMode = "hard" | "light" | "recovery";

function getExercises(
  workout: Workout,
  mode: TabMode
): Exercise[] {
  const v =
    mode === "hard"
      ? workout.hard_version
      : mode === "light"
      ? workout.light_version
      : workout.recovery_version;
  return v?.exercises ?? [];
}

function hasVersion(workout: Workout, mode: TabMode): boolean {
  const v =
    mode === "hard"
      ? workout.hard_version
      : mode === "light"
      ? workout.light_version
      : workout.recovery_version;
  return !!v?.exercises?.length;
}

export default function WorkoutDetailPage() {
  const params = useParams();
  const router = useRouter();
  const day = Number(params.day);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [programId, setProgramId] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<TabMode>("hard");
  const [completing, setCompleting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (![1, 2, 3].includes(day)) {
      router.replace("/app/trial");
      return;
    }

    fetch(`/api/trial/workout/${day}`)
      .then((r) => {
        if (!r.ok) {
          if (r.status === 403) router.replace("/app/programs");
          else if (r.status === 404) return null;
          throw new Error("Failed to load");
        }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setWorkout(data.workout);
          setProgramId(data.program_id);
          setIsCompleted(data.is_completed ?? false);
          if (data.workout) {
            if (hasVersion(data.workout, "hard")) setMode("hard");
            else if (hasVersion(data.workout, "light")) setMode("light");
            else if (hasVersion(data.workout, "recovery")) setMode("recovery");
          }
        }
      })
      .catch(() => router.replace("/app/trial"))
      .finally(() => setLoading(false));
  }, [day, router]);

  useEffect(() => {
    if (!programId || !workout) return;

    fetch("/api/trial/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        program_id: programId,
        activity_type: "view_workout",
        metadata: { day_number: day, workout_id: workout.id },
      }),
    });
  }, [programId, workout?.id, day]);

  const handleComplete = async () => {
    if (!programId || completing) return;
    setCompleting(true);
    try {
      const res = await fetch("/api/trial/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: programId,
          activity_type: "complete_trial_day",
          metadata: { day_number: day },
        }),
      });
      if (res.ok) {
        setIsCompleted(true);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-neutral-500">Đang tải...</p>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="space-y-4">
        <p className="text-neutral-600">Không tìm thấy bài tập.</p>
        <Link
          href="/app/trial"
          className="inline-block text-sm font-medium text-primary hover:underline"
        >
          ← Quay lại
        </Link>
      </div>
    );
  }

  const typeLabel =
    WORKOUT_TYPE_LABEL[workout.workout_type] ?? workout.workout_type;
  const exercises = getExercises(workout, mode);
  const tabs: { key: TabMode; label: string }[] = [];
  if (hasVersion(workout, "hard")) tabs.push({ key: "hard", label: "Hard" });
  if (hasVersion(workout, "light")) tabs.push({ key: "light", label: "Light" });
  if (hasVersion(workout, "recovery"))
    tabs.push({ key: "recovery", label: "Recovery" });

  if (tabs.length === 0) tabs.push({ key: "hard", label: "Hard" });

  return (
    <div className="space-y-6 pb-24">
      <Link
        href="/app/trial"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        ← Quay lại
      </Link>

      <div>
        <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
          Ngày {day} — {workout.title}
        </h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-primary">
            {workout.duration_minutes} phút
          </span>
          <span className="rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
            {typeLabel}
          </span>
          {isCompleted && (
            <span className="rounded-full bg-success/20 px-2.5 py-0.5 text-xs font-medium text-success">
              Đã hoàn thành ✓
            </span>
          )}
        </div>
      </div>

      {/* Video placeholder */}
      <div className="flex aspect-video items-center justify-center rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50">
        <div className="flex flex-col items-center gap-2 text-neutral-400">
          <Play className="h-12 w-12" strokeWidth={1.5} />
          <span className="text-sm">Video sẽ được cập nhật</span>
        </div>
      </div>

      {/* Mode tabs */}
      {tabs.length > 1 && (
        <div className="flex gap-2 rounded-lg bg-neutral-100 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setMode(t.key)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                mode === t.key
                  ? "bg-white text-primary shadow-sm"
                  : "text-neutral-600 hover:text-primary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Exercises */}
      <div>
        <h2 className="font-heading text-lg font-semibold text-primary">
          Danh sách bài tập
        </h2>
        <ul className="mt-3 space-y-3">
          {exercises.length > 0 ? (
            exercises.map((ex, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3"
              >
                <span className="font-medium text-neutral-800">{ex.name}</span>
                <span className="text-sm text-neutral-500">
                  {ex.reps != null
                    ? `${ex.sets ?? 1} x ${ex.reps} reps`
                    : ex.duration_seconds != null
                    ? `${ex.sets ?? 1} x ${ex.duration_seconds}s`
                    : ex.sets != null
                    ? `${ex.sets} sets`
                    : "—"}
                </span>
              </li>
            ))
          ) : (
            <li className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
              Chưa có bài tập cho chế độ này
            </li>
          )}
        </ul>
      </div>

      {/* Complete button */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-200 bg-white/95 p-4 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <button
          type="button"
          onClick={handleComplete}
          disabled={completing || isCompleted}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-secondary-light transition-colors hover:bg-primary-dark disabled:opacity-60 sm:w-auto sm:min-w-[200px]"
        >
          {completing
            ? "Đang xử lý..."
            : isCompleted
            ? "Đã hoàn thành ✓"
            : "Hoàn thành bài tập"}
        </button>
      </div>

      {/* Success overlay with confetti */}
      {showSuccess && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          role="alert"
          aria-live="polite"
        >
          <Confetti />
          <div className="relative mx-4 rounded-xl bg-white p-8 text-center shadow-xl">
            <div className="mb-4 text-4xl">🎉</div>
            <p className="font-heading text-xl font-bold text-primary">
              Tuyệt vời! Bạn đã hoàn thành ngày {day}
            </p>
            <p className="mt-2 text-neutral-600">
              Tiếp tục với các bài tập khác nhé!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
