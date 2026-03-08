"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Play } from "lucide-react";
import { CheckInModal } from "@/components/completion/CheckInModal";
import { CelebrationOverlay } from "@/components/completion/CelebrationOverlay";
import { Toast } from "@/components/ui/Toast";

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
  week_number?: number;
  title: string;
  description: string | null;
  duration_minutes: number;
  workout_type: string;
  hard_version: VersionData | null;
  light_version: VersionData | null;
  recovery_version: VersionData | null;
}

const WORKOUT_TYPE_LABEL: Record<string, string> = {
  main: "Main",
  recovery: "Recovery",
  flexible: "Linh hoạt",
};

const MODE_DESCRIPTIONS: Record<string, string> = {
  hard: "Đầy đủ cường độ — cho ngày bạn tràn đầy năng lượng",
  light: "Giảm cường độ — cho ngày bạn cần nhẹ nhàng hơn",
  recovery: "Phục hồi — stretching và thư giãn",
};

const FEELING_OPTIONS = [
  { value: 1, label: "Rất mệt", emoji: "😤" },
  { value: 2, label: "Hơi mệt", emoji: "😅" },
  { value: 3, label: "Vừa phải", emoji: "😊" },
  { value: 4, label: "Tốt", emoji: "💪" },
  { value: 5, label: "Tuyệt vời", emoji: "🔥" },
];

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

export default function ProgramWorkoutPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const day = Number(params.day);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<TabMode>("hard");
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedData, setCompletedData] = useState<{
    mode: TabMode;
    feeling: number;
  } | null>(null);
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{
    currentStreak: number;
    newMilestones: { milestone_type: string; achieved_at: string }[];
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isInRescue, setIsInRescue] = useState(false);

  useEffect(() => {
    if (!Number.isInteger(day) || day < 1) {
      router.replace("/app/program");
      return;
    }

    fetch(`/api/program/workout/${day}`)
      .then((r) => {
        if (!r.ok) {
          if (r.status === 403) router.replace("/app");
          else if (r.status === 404) return null;
          throw new Error("Failed");
        }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setWorkout(data.workout);
          setEnrollmentId(data.enrollment_id ?? null);
          setIsCompleted(data.is_completed ?? false);
          if (data.checkin) {
            setCompletedData({
              mode: data.checkin.mode,
              feeling: data.checkin.feeling ?? 3,
            });
            setMode(data.checkin.mode);
          } else if (data.workout) {
            const urlMode = searchParams.get("mode") as TabMode | null;
            if (urlMode && ["hard", "light", "recovery"].includes(urlMode) && hasVersion(data.workout, urlMode)) {
              setMode(urlMode);
            } else if (hasVersion(data.workout, "hard")) {
              setMode("hard");
            } else if (hasVersion(data.workout, "light")) {
              setMode("light");
            } else if (hasVersion(data.workout, "recovery")) {
              setMode("recovery");
            }
          }
        }
      })
      .catch(() => router.replace("/app/program"))
      .finally(() => setLoading(false));
  }, [day, router, searchParams]);

  useEffect(() => {
    fetch("/api/rescue/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data?.is_in_rescue && setIsInRescue(true))
      .catch(() => {});
  }, []);

  const handleOpenCheckIn = () => {
    setCheckInModalOpen(true);
  };

  const handleCheckInSubmit = async (params: {
    mode: TabMode;
    feeling: number;
    note?: string;
  }) => {
    if (!enrollmentId) {
      setToast("Không tìm thấy chương trình. Vui lòng thử lại.");
      return;
    }

    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enrollment_id: enrollmentId,
        day_number: day,
        mode: params.mode,
        feeling: params.feeling,
        feeling_note: params.note || undefined,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 409) {
        setToast("Bạn đã check-in ngày này rồi.");
        setIsCompleted(true);
        setCompletedData({ mode: params.mode, feeling: params.feeling });
        setCheckInModalOpen(false);
        return;
      }
      setToast(data.error ?? "Có lỗi xảy ra. Vui lòng thử lại.");
      throw new Error(data.error);
    }

    setCheckInModalOpen(false);
    setCompletedData({ mode: params.mode, feeling: params.feeling });
    setIsCompleted(true);
    setCelebrationData({
      currentStreak: data.streak?.current_streak ?? 0,
      newMilestones: data.new_milestones ?? [],
    });
    setShowCelebration(true);
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
          href="/app/program"
          className="inline-block text-sm font-medium text-primary hover:underline"
        >
          ← Quay lại chương trình
        </Link>
      </div>
    );
  }

  const typeLabel =
    WORKOUT_TYPE_LABEL[workout.workout_type] ?? workout.workout_type;
  const weekNum = workout.week_number ?? Math.ceil(day / 7);
  const exercises = getExercises(workout, mode);
  const modeOptions: { key: TabMode; label: string }[] = [];
  if (hasVersion(workout, "hard")) modeOptions.push({ key: "hard", label: "HARD" });
  if (hasVersion(workout, "light")) modeOptions.push({ key: "light", label: "LIGHT" });
  if (hasVersion(workout, "recovery"))
    modeOptions.push({ key: "recovery", label: "RECOVERY" });
  if (modeOptions.length === 0) modeOptions.push({ key: "hard", label: "HARD" });

  const feelingLabel = (n: number) =>
    FEELING_OPTIONS.find((f) => f.value === n)?.label ?? "";

  return (
    <div className="space-y-6 pb-36">
      <Link
        href="/app/program"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        ← Quay lại chương trình
      </Link>

      {/* Header */}
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
          <span className="rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
            Tuần {weekNum}
          </span>
          {isCompleted && (
            <span className="rounded-full bg-success/20 px-2.5 py-0.5 text-xs font-medium text-success">
              Đã hoàn thành ✓
            </span>
          )}
        </div>
      </div>

      {/* Rescue mode message — when in rescue and doing light/recovery */}
      {isInRescue && (mode === "light" || mode === "recovery") && !isCompleted && (
        <p className="rounded-lg bg-primary/5 px-4 py-2.5 text-sm text-primary">
          Bạn đang ở chế độ nhẹ nhàng. Mỗi phút đều đáng giá! 💪
        </p>
      )}

      {/* Mode buttons */}
      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          {modeOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => !isCompleted && setMode(opt.key)}
              disabled={isCompleted}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold uppercase transition-all ${
                mode === opt.key
                  ? "border-2 border-primary bg-primary text-secondary-light shadow-md"
                  : isCompleted
                  ? "border-2 border-neutral-100 bg-neutral-50 text-neutral-400"
                  : "border-2 border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {!isCompleted && (
          <p className="text-sm text-neutral-600">
            {MODE_DESCRIPTIONS[mode]}
          </p>
        )}
      </div>

      {/* Video area */}
      <div className="aspect-video overflow-hidden rounded-xl border-2 border-neutral-200 bg-neutral-100">
        <div className="flex h-full w-full items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-neutral-400">
            <Play className="h-14 w-14" strokeWidth={1.5} />
            <span className="text-sm">Video bài tập sẽ được cập nhật</span>
          </div>
        </div>
      </div>

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
                      : "—"}
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

      {/* Footer sticky */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-200 bg-white/95 p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur">
        {!isCompleted ? (
          <div className="mx-auto max-w-lg">
            <button
              type="button"
              onClick={handleOpenCheckIn}
              className="w-full rounded-xl bg-primary px-4 py-4 text-base font-semibold text-secondary-light transition-colors hover:bg-primary-dark"
            >
              Hoàn thành bài tập
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-lg space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-success/10 px-4 py-3">
              <span className="font-medium text-success">✓ Đã hoàn thành</span>
              {completedData && (
                <>
                  <span className="text-neutral-500">—</span>
                  <span className="text-neutral-600 capitalize">
                    {completedData.mode}
                  </span>
                  <span className="text-neutral-500">—</span>
                  <span>
                    {FEELING_OPTIONS.find((f) => f.value === completedData.feeling)
                      ?.emoji}{" "}
                    {feelingLabel(completedData.feeling)}
                  </span>
                </>
              )}
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

      <CheckInModal
        open={checkInModalOpen}
        onClose={() => setCheckInModalOpen(false)}
        day={day}
        mode={mode}
        modeOptions={modeOptions}
        onSubmit={handleCheckInSubmit}
      />

      <CelebrationOverlay
        open={showCelebration}
        day={day}
        currentStreak={celebrationData?.currentStreak ?? 0}
        newMilestones={celebrationData?.newMilestones ?? []}
        onClose={() => setShowCelebration(false)}
      />

      <Toast
        message={toast ?? ""}
        open={!!toast}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
