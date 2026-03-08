"use client";

import Link from "next/link";
import { useState } from "react";
import { PauseModal } from "./PauseModal";

export type RiskLevel = "low" | "medium" | "high" | "critical";

interface RescueBannerProps {
  riskLevel: RiskLevel;
  suggestedMode: "hard" | "light" | "recovery";
  programDay: number;
  completedDays: number;
  lightDuration: number;
  recoveryDuration: number;
  interventionId: string;
  onPauseSuccess?: () => void;
}

export function RescueBanner({
  riskLevel,
  suggestedMode,
  programDay,
  completedDays,
  lightDuration,
  recoveryDuration,
  interventionId,
  onPauseSuccess,
}: RescueBannerProps) {
  const [pauseModalOpen, setPauseModalOpen] = useState(false);

  const workoutHref = (mode?: string) => {
    const base = `/app/program/workout/${programDay}`;
    return mode ? `${base}?mode=${mode}` : base;
  };

  if (effectiveRisk === "medium") {
    return (
      <>
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="text-3xl" aria-hidden>
                🌿
              </span>
              <div>
                <p className="font-heading font-semibold text-amber-900">
                  Hôm nay thử nhẹ nhàng nhé
                </p>
                <p className="mt-1 text-sm text-amber-800/90">
                  Chọn Light mode — {lightDuration} phút là đủ để giữ nhịp
                </p>
              </div>
            </div>
            <Link
              href={workoutHref("light")}
              className="shrink-0 rounded-lg bg-amber-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-amber-700"
            >
              Tập Light hôm nay
            </Link>
          </div>
        </div>
      </>
    );
  }

  if (effectiveRisk === "high") {
    return (
      <>
        <div className="rounded-xl border border-orange-200 bg-orange-50/80 p-4 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <span className="text-3xl" aria-hidden>
                🧘
              </span>
              <div>
                <p className="font-heading font-semibold text-orange-900">
                  Quay lại bất cứ lúc nào
                </p>
                <p className="mt-1 text-sm text-orange-800/90">
                  Một bài Recovery {recoveryDuration} phút sẽ giúp bạn lấy lại nhịp
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={workoutHref("recovery")}
                className="rounded-lg bg-orange-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-orange-700"
              >
                Tập Recovery
              </Link>
              <button
                type="button"
                onClick={() => setPauseModalOpen(true)}
                className="rounded-lg border border-orange-300 bg-white px-4 py-2.5 text-sm font-medium text-orange-800 transition-colors hover:bg-orange-50"
              >
                Tôi cần nghỉ thêm
              </button>
            </div>
          </div>
        </div>
        <PauseModal
          open={pauseModalOpen}
          onClose={() => setPauseModalOpen(false)}
          interventionId={interventionId}
          onSuccess={onPauseSuccess}
        />
      </>
    );
  }

  // critical
  return (
    <>
      <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="text-3xl" aria-hidden>
              ❤️
            </span>
            <div>
              <p className="font-heading font-semibold text-rose-900">
                Chúng tôi ở đây chờ bạn
              </p>
              <p className="mt-1 text-sm text-rose-800/90">
                Bạn đã đi được {completedDays} ngày. Khi sẵn sàng, chỉ cần 10 phút.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={workoutHref()}
              className="rounded-lg bg-rose-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-rose-700"
            >
              Quay lại tập
            </Link>
            <button
              type="button"
              onClick={() => setPauseModalOpen(true)}
              className="rounded-lg border border-rose-300 bg-white px-4 py-2.5 text-sm font-medium text-rose-800 transition-colors hover:bg-rose-50"
            >
              Tạm dừng chương trình
            </button>
          </div>
        </div>
      </div>
      <PauseModal
        open={pauseModalOpen}
        onClose={() => setPauseModalOpen(false)}
        interventionId={interventionId}
        onSuccess={onPauseSuccess}
      />
    </>
  );
}
