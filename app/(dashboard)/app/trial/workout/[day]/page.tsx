"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Play } from "lucide-react";
import { Toast } from "@/components/ui/Toast";
import { VimeoPlayer } from "@/components/workout/VimeoPlayer";

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

const WORKOUT_TYPE_LABEL: Record<string, string> = {
  main: "Chính",
  recovery: "Phục hồi",
  review: "Review",
  flexible: "Linh hoạt",
};

const MODE_DESCRIPTIONS: Record<string, string> = {
  hard: "Đầy đủ cường độ – cho ngày bạn tràn đầy năng lượng",
  light: "Giảm cường độ – cho ngày bạn cần nhẹ nhàng hơn",
  recovery: "Phục hồi – stretching và thư giãn",
};

type TabMode = "hard" | "light" | "recovery";

function getExercises(workout: Workout, mode: TabMode): Exercise[] {
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

export default function TrialWorkoutPage() {
  const params = useParams();
  const router = useRouter();
  const day = Number(params.day);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [programId, setProgramId] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<TabMode>("hard");
  const [completing, setCompleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
        setToast("Tuyệt vời! Bạn đã hoàn thành ngày " + day);
        setTimeout(() => router.push("/app/trial"), 1500);
      } else {
        setToast("Có lỗi xảy ra. Vui lòng thử lại.");
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
  const modeOptions: { key: TabMode; label: string }[] = [];
  if (hasVersion(workout, "hard")) modeOptions.push({ key: "hard", label: "HARD" });
  if (hasVersion(workout, "light")) modeOptions.push({ key: "light", label: "LIGHT" });
  if (hasVersion(workout, "recovery"))
    modeOptions.push({ key: "recovery", label: "RECOVERY" });
  if (modeOptions.length === 0) modeOptions.push({ key: "hard", label: "HARD" });

  return (
    <div className="space-y-6 pb-36">
      <Link
        href="/app/trial"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        ← Quay lại trải nghiệm
      </Link>

      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
          Ngày {day} – {workout.title}
        </h1>
        {workout.description && (
          <p className="mt-1 text-sm text-neutral-400">{workout.description}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-primary">
            {workout.duration_minutes} phút
          </span>
          <span className="rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
            {typeLabel}
          </span>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            Trial
          </span>
          {isCompleted && (
            <span className="rounded-full bg-success/20 px-2.5 py-0.5 text-xs font-medium text-success">
              Đã hoàn thành ✓
            </span>
          )}
        </div>
      </div>

      {/* Mode buttons */}
      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          {modeOptions.map((opt) => {
            const rounds = opt.key === "hard" ? 3 : opt.key === "light" ? 2 : 1;
            const perRound = workout.duration_minutes > 0
              ? Math.round(workout.duration_minutes / 3)
              : 7;
            const dur = rounds * perRound;
            const emoji = opt.key === "hard" ? "💪" : opt.key === "light" ? "🌿" : "🧘";
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setMode(opt.key)}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition-all ${
                  mode === opt.key
                    ? "border-2 border-primary bg-primary text-secondary-light shadow-md"
                    : "border-2 border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
                }`}
              >
                {emoji} {opt.label} – {rounds} lượt (~{dur} phút)
              </button>
            );
          })}
        </div>
        <p className="text-sm text-neutral-600">
          {MODE_DESCRIPTIONS[mode]}
        </p>
      </div>

      {/* Video area — Vimeo embed */}
      {(() => {
        const version = mode === "hard" ? workout.hard_version : mode === "light" ? workout.light_version : workout.recovery_version;
        const videoUrl = version?.video_url ?? workout.hard_version?.video_url;
        if (videoUrl && videoUrl.includes("vimeo.com")) {
          return <VimeoPlayer videoUrl={videoUrl} title={workout.title} />;
        }
        return (
          <div className="aspect-video overflow-hidden rounded-xl border-2 border-neutral-200 bg-neutral-100">
            <div className="flex h-full w-full items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-neutral-400">
                <Play className="h-14 w-14" strokeWidth={1.5} />
                <span className="text-sm">Video bài tập sẽ được cập nhật</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Exercise list */}
      <div>
        <h2 className="font-heading text-lg font-semibold text-primary">
          Danh sách bài tập
        </h2>
        <ul className="mt-3 space-y-3">
          {exercises.length > 0 ? (
            exercises.map((ex, i) => (
              <li
                key={i}
                className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-2xl">
                  💪
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-neutral-800">{ex.name}</span>
                  <p className="mt-0.5 text-sm text-neutral-500">
                    {ex.reps != null
                      ? `${ex.sets ?? 1} × ${ex.reps} reps`
                      : ex.duration_seconds != null
                      ? `${ex.sets ?? 1} × ${ex.duration_seconds}s`
                      : ex.sets != null
                      ? `${ex.sets} sets`
                      : "–"}
                  </p>
                </div>
              </li>
            ))
          ) : (
            <li className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
              Chưa có bài tập cho chế độ này
            </li>
          )}
        </ul>
      </div>

      {/* Zalo note */}
      <div className="rounded-lg bg-primary/5 px-4 py-3 text-sm text-neutral-600">
        <span className="font-medium text-primary">Lưu ý:</span> Check-in chính thức qua Zalo OA (reply 1/2/3). Nút bên dưới là backup.
      </div>

      {/* Footer sticky */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-200 bg-white/95 p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur">
        {!isCompleted ? (
          <div className="mx-auto max-w-lg">
            <button
              type="button"
              onClick={handleComplete}
              disabled={completing}
              className="w-full rounded-xl bg-primary px-4 py-4 text-base font-semibold text-secondary-light transition-colors hover:bg-primary-dark disabled:opacity-60"
            >
              {completing ? "Đang xử lý..." : "Hoàn thành ngày"}
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-lg space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-success/10 px-4 py-3">
              <span className="font-medium text-success">✓ Đã hoàn thành</span>
            </div>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="block w-full rounded-xl border-2 border-primary px-4 py-3 text-center font-medium text-primary transition-colors hover:bg-primary/5"
            >
              Xem lại bài tập
            </button>
          </div>
        )}
      </div>

      <Toast
        message={toast ?? ""}
        open={!!toast}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
