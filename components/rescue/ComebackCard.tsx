"use client";

import Link from "next/link";

interface ComebackCardProps {
  programDay: number;
  currentStreak?: number;
  onDismiss?: () => void;
}

export function ComebackCard({
  programDay,
  currentStreak = 1,
  onDismiss,
}: ComebackCardProps) {
  return (
    <div className="relative rounded-xl border border-success/30 bg-success/10 p-4 shadow-sm">
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-3 top-3 rounded p-1 text-neutral-500 transition-colors hover:bg-success/20 hover:text-neutral-700"
          aria-label="Đóng"
        >
          ✕
        </button>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-heading text-lg font-semibold text-primary">
            Chào mừng quay lại! 🎉
          </p>
          <p className="mt-1 text-sm text-neutral-700">
            Dừng lại rồi quay lại — đó là sức mạnh, không phải yếu đuối.
          </p>
          <p className="mt-2 text-sm font-medium text-primary">
            Streak mới: 🔥 {currentStreak} ngày
          </p>
        </div>
        <Link
          href={`/app/program/workout/${programDay}`}
          className="shrink-0 rounded-lg bg-primary px-4 py-2.5 font-medium text-secondary-light transition-colors hover:bg-primary-dark"
        >
          Tiếp tục hành trình
        </Link>
      </div>
    </div>
  );
}
