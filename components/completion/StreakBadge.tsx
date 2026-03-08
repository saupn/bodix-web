"use client";

interface StreakBadgeProps {
  currentStreak: number;
  longestStreak: number;
  compact?: boolean;
}

export function StreakBadge({
  currentStreak,
  longestStreak,
  compact = false,
}: StreakBadgeProps) {
  const getBorderClass = () => {
    if (currentStreak >= 21) return "ring-2 ring-amber-400/80 ring-offset-2 animate-streak-epic";
    if (currentStreak >= 14) return "ring-2 ring-amber-300/70 ring-offset-2 animate-streak-high";
    if (currentStreak >= 7) return "ring-2 ring-amber-200/60 ring-offset-2 animate-streak-glow";
    return "";
  };

  const label =
    currentStreak === 0
      ? "Bắt đầu streak mới!"
      : `🔥 ${currentStreak} ngày`;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary ${getBorderClass()}`}
      >
        <span>{currentStreak === 0 ? "✨" : "🔥"}</span>
        <span>{currentStreak === 0 ? "0" : currentStreak}</span>
      </span>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl bg-primary/10 px-4 py-3 text-center ${getBorderClass()}`}
    >
      <span className="font-heading text-lg font-semibold text-primary">
        {label}
      </span>
      {currentStreak > 0 && longestStreak > currentStreak && (
        <span className="mt-1 text-xs text-neutral-600">
          Kỷ lục: {longestStreak} ngày
        </span>
      )}
    </div>
  );
}
