"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { VimeoPlayer } from "@/components/workout/VimeoPlayer";

/**
 * Pre-trial preview card — chỉ XEM TRƯỚC bài Ngày 1, KHÔNG phải tập thử.
 *
 * Mở modal phát video bài thật của Ngày 1. KHÔNG gọi API check-in, KHÔNG ghi
 * trial_activities, KHÔNG đụng day-gating → user vẫn tập đủ Ngày 1 vào đúng ngày.
 * Video được fetch sẵn ở server (page.tsx) và truyền xuống — modal chỉ phát.
 */
export function TrialPreviewCard({
  startDateLabel,
  videoUrl,
  workoutTitle,
}: {
  startDateLabel: string | null;
  videoUrl: string | null;
  workoutTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const hasVideo = !!videoUrl && videoUrl.includes("vimeo.com");

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-white p-6">
      <h3 className="font-heading text-lg font-semibold text-neutral-900">
        Bài tập trải nghiệm thử
      </h3>
      <p className="mt-1 text-sm text-neutral-600">
        {startDateLabel
          ? `Tập thử bắt đầu ${startDateLabel}. Xem trước bài tập Ngày 1 nếu bạn tò mò nhé!`
          : "Xem trước bài tập Ngày 1 nếu bạn tò mò nhé!"}
      </p>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-secondary-light transition-colors hover:bg-primary-dark"
      >
        Xem trước bài Ngày 1 →
      </button>

      <p className="mt-2 text-xs text-neutral-500">
        Đây chỉ là xem trước – không tính là buổi tập. Buổi tập thật Ngày 1 mở
        đúng ngày bắt đầu, lúc đó bạn check-in mới được tính.
      </p>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white p-4 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-heading text-base font-semibold text-primary">
                Xem trước – Ngày 1{workoutTitle ? `: ${workoutTitle}` : ""}
              </h4>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-neutral-500 transition-colors hover:bg-neutral-100"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4">
              {hasVideo ? (
                <VimeoPlayer videoUrl={videoUrl!} title={workoutTitle} />
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-lg border-2 border-neutral-200 bg-neutral-100 text-sm text-neutral-600">
                  Video bài tập sẽ được cập nhật
                </div>
              )}
            </div>

            <p className="mt-4 text-xs text-neutral-500">
              Đây là xem trước, không phải tập thử. Buổi tập thật Ngày 1 sẽ mở
              đúng ngày bắt đầu – khi đó bạn mới check-in để được tính tiến trình.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
