"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getTrialExperienceDay } from "@/lib/trial/calendar";

interface Workout {
  id: string;
  day_number: number;
  title: string;
  duration_minutes: number;
  workout_type: string;
}

interface Program {
  id: string;
  slug: string;
  name: string;
  price_vnd: number;
}

interface TrialData {
  is_trial: boolean;
  is_expired: boolean;
  trial_ends_at: string | null;
  bodix_start_date?: string | null;
  bodix_current_day?: number | null;
  days_remaining: number;
  hours_remaining: number;
  can_access_content: boolean;
  program: Program | null;
  enrollment: {
    id: string;
    program_id: string;
    enrolled_at: string;
    current_day: number;
  } | null;
  activity_summary: Record<string, number>;
}

const WORKOUT_TYPE_LABEL: Record<string, string> = {
  main: "Chính",
  recovery: "Recovery",
  flexible: "Linh hoạt",
};

function formatPrice(vnd: number): string {
  return new Intl.NumberFormat("vi-VN").format(vnd) + "₫";
}

function formatVnYmd(ymd: string): string {
  const [y, m, d] = ymd.split("T")[0].split("-");
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

function useCountdown(trialEndsAt: string | null) {
  const [diff, setDiff] = useState<{ days: number; hours: number } | null>(
    null
  );

  useEffect(() => {
    if (!trialEndsAt) {
      setDiff(null);
      return;
    }

    const update = () => {
      const end = new Date(trialEndsAt).getTime();
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
  }, [trialEndsAt]);

  return diff;
}

export function TrialPageContent() {
  const router = useRouter();
  const [data, setData] = useState<TrialData | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  const countdown = useCountdown(data?.trial_ends_at ?? null);

  useEffect(() => {
    if (countdown?.days === 0 && countdown?.hours === 0 && data && !data.is_expired) {
      fetch("/api/trial/status")
        .then((r) => r.json())
        .then((d) => setData(d));
    }
  }, [countdown?.days, countdown?.hours, data?.is_expired]);

  useEffect(() => {
    async function load() {
      const [statusRes, workoutsRes] = await Promise.all([
        fetch("/api/trial/status"),
        fetch("/api/trial/workouts"),
      ]);

      const statusData = await statusRes.json();
      if (!statusRes.ok || !statusData.can_access_content || !statusData.enrollment) {
        router.replace("/app/programs");
        return;
      }

      setData(statusData);

      if (workoutsRes.ok) {
        const { workouts: w } = await workoutsRes.json();
        setWorkouts(w ?? []);
      }
      setLoading(false);
    }
    load();
  }, [router]);

  useEffect(() => {
    if (!data?.enrollment?.program_id) return;
    fetch("/api/trial/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        program_id: data.enrollment.program_id,
        activity_type: "view_program",
        metadata: {},
      }),
    });
  }, [data?.enrollment?.program_id]);

  if (loading || !data) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-neutral-600">Đang tải...</p>
      </div>
    );
  }

  const trialExp = getTrialExperienceDay(data.bodix_start_date ?? null);
  const program = data.program;
  const tryCount =
    (data.activity_summary?.try_workout ?? 0) +
    (data.activity_summary?.view_workout ?? 0);

  if (data.is_expired) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border-2 border-accent/40 bg-accent/10 p-6 sm:p-8 text-center">
          <h2 className="font-heading text-xl font-bold text-primary sm:text-2xl">
            3 ngày trải nghiệm đã kết thúc!
          </h2>
          <p className="mt-3 text-neutral-600">
            Bạn đã thử {tryCount} bài tập
          </p>
          <p className="mt-2 text-neutral-600">
            Đăng ký ngay để tiếp tục hành trình
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {["bodix-21", "bodix-6w", "bodix-12w"].map((slug) => (
              <Link
                key={slug}
                href={`/app/checkout/${slug}`}
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-secondary-light transition-colors hover:bg-primary-dark"
              >
                {slug === "bodix-21"
                  ? "BodiX 21"
                  : slug === "bodix-6w"
                  ? "BodiX 6W"
                  : "BodiX 12W"}
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const workoutsByDay = Object.fromEntries(
    workouts.map((w) => [w.day_number, w])
  );

  // Days remaining = 3 - currentDay (where startDate = ngày 1).
  // When trialExp = 0 (chưa bắt đầu) we show a different banner; the "còn X ngày" pill
  // only makes sense once the trial is running.
  const daysRemaining = trialExp > 0 ? Math.max(0, 3 - trialExp) : null;

  return (
    <div className="pb-24 sm:pb-8">
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
            Trải nghiệm {program?.name ?? "chương trình"}
          </h1>
          {trialExp > 0 ? (
            <>
              {daysRemaining !== null && daysRemaining > 0 && (
                <span className="mt-2 inline-block rounded-full bg-primary/15 px-3 py-1 text-sm font-medium text-primary">
                  Còn {daysRemaining} ngày trải nghiệm
                </span>
              )}
              <p className="mt-2 text-neutral-700">
                Đang trải nghiệm thử – Ngày {Math.min(trialExp, 3)}/3
              </p>
            </>
          ) : (
            <p className="mt-2 text-neutral-700">
              Trải nghiệm thử bắt đầu từ ngày mai
            </p>
          )}
        </div>

        {data.bodix_start_date && trialExp === 0 && (
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-center text-neutral-800">
            <p className="font-medium">
              Trải nghiệm thử bắt đầu vào ngày{" "}
              {formatVnYmd(data.bodix_start_date)}.
            </p>
            <p className="mt-2 text-sm text-neutral-700">
              Sáng mai lúc 6:30 bạn sẽ nhận tin nhắc tập đầu tiên qua Zalo. Chuẩn bị tinh thần nhé! 💪
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((day) => {
            const workout = workoutsByDay[day];
            const isUnlocked = trialExp > 0 && day <= trialExp;
            const isPast = trialExp > 0 && day < trialExp;

            return (
              <WorkoutCard
                key={day}
                day={day}
                workout={workout}
                isUnlocked={isUnlocked}
                isPast={isPast}
                programId={data.enrollment?.program_id}
              />
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-200 bg-white/95 p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur sm:static sm:mt-8 sm:rounded-xl sm:border sm:border-primary/20 sm:bg-primary/5 sm:p-6 sm:shadow-none">
        <p className="font-heading font-semibold text-primary">
          Thích chương trình này?
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={
              program?.slug
                ? `/app/checkout/${program.slug}`
                : "/app/checkout/bodix-21"
            }
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-secondary-light transition-colors hover:bg-primary-dark"
          >
            Đăng ký đầy đủ – {program ? formatPrice(program.price_vnd) : "Liên hệ"}
          </Link>
          {daysRemaining !== null && daysRemaining > 0 && (
            <p className="text-center text-sm text-neutral-700 sm:text-left">
              Hoặc tiếp tục trải nghiệm, còn {daysRemaining} ngày
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkoutCard({
  day,
  workout,
  isUnlocked,
  isPast,
  programId,
}: {
  day: number;
  workout: Workout | undefined;
  isUnlocked: boolean;
  isPast: boolean;
  programId: string | undefined;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!isUnlocked || !programId) return;
    setLoading(true);
    try {
      await fetch("/api/trial/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: programId,
          activity_type: "view_workout",
          metadata: { day_number: day },
        }),
      });
      router.push(`/app/trial/workout/${day}`);
    } finally {
      setLoading(false);
    }
  };

  const typeLabel = workout
    ? WORKOUT_TYPE_LABEL[workout.workout_type] ?? workout.workout_type
    : "";

  return (
    <div
      className={`rounded-xl border-2 p-5 transition-all ${
        isUnlocked
          ? "cursor-pointer border-neutral-200 bg-white shadow-sm hover:border-primary/30 hover:shadow-md"
          : "border-neutral-100 bg-neutral-50/80 opacity-75"
      }`}
      onClick={isUnlocked ? handleClick : undefined}
      role={isUnlocked ? "button" : undefined}
    >
      <h3 className="font-heading font-semibold text-primary">
        Ngày {day}
        {workout && (
          <span className="ml-2 text-xs font-normal text-neutral-600">
            {typeLabel}
          </span>
        )}
      </h3>
      {workout ? (
        <>
          <p className="mt-1 text-sm text-neutral-600 line-clamp-2">
            {workout.title}
          </p>
          <p className="mt-1 text-xs text-accent">{workout.duration_minutes} phút</p>
        </>
      ) : (
        <p className="mt-1 text-sm text-neutral-600">–</p>
      )}

      {isUnlocked ? (
        <p className="mt-4 text-sm font-medium text-primary">
          {loading ? "Đang chuyển..." : isPast ? "Xem lại" : "Bắt đầu tập"}
        </p>
      ) : (
        <p className="mt-4 text-sm text-neutral-600">Mở khóa theo từng ngày</p>
      )}
    </div>
  );
}
