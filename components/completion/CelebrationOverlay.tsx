"use client";

import { useEffect } from "react";
import { MILESTONE_CONFIG } from "@/lib/completion/milestones";

interface Milestone {
  milestone_type: string;
  achieved_at: string;
}

interface CelebrationOverlayProps {
  open: boolean;
  day: number;
  currentStreak: number;
  newMilestones: Milestone[];
  onClose: () => void;
  durationMs?: number;
}

function ConfettiParticles() {
  const colors = ["#2D4A3E", "#C4785A", "#7CB083", "#E8DFD0"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 40 }).map((_, i) => (
        <div
          key={i}
          className="absolute h-2 w-2 animate-confetti-fall rounded-full opacity-90"
          style={{
            left: `${(i * 2.5) % 100}%`,
            top: "-10px",
            backgroundColor: colors[i % colors.length],
            animationDelay: `${i * 30}ms`,
            animationDuration: "2.5s",
          }}
        />
      ))}
    </div>
  );
}

export function CelebrationOverlay({
  open,
  day,
  currentStreak,
  newMilestones,
  onClose,
  durationMs = 2500,
}: CelebrationOverlayProps) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [open, durationMs, onClose]);

  if (!open) return null;

  const topMilestone = newMilestones.length > 0
    ? newMilestones.reduce((a, b) => {
        const configA = MILESTONE_CONFIG[a.milestone_type];
        const configB = MILESTONE_CONFIG[b.milestone_type];
        const levelOrder = { low: 0, medium: 1, high: 2, epic: 3 };
        const scoreA = configA ? levelOrder[configA.celebration_level] : 0;
        const scoreB = configB ? levelOrder[configB.celebration_level] : 0;
        return scoreB > scoreA ? b : a;
      })
    : null;

  const config = topMilestone
    ? MILESTONE_CONFIG[topMilestone.milestone_type]
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="alert"
      aria-live="polite"
    >
      <ConfettiParticles />
      <div className="relative mx-4 max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
        {config ? (
          <>
            <div className="mb-4 text-6xl">{config.emoji}</div>
            <h2 className="font-heading text-2xl font-bold text-primary">
              {config.label}
            </h2>
            <p className="mt-2 text-neutral-600">{config.description}</p>
            {currentStreak > 0 && (
              <p className="mt-4 text-sm font-medium text-primary">
                Streak: 🔥 {currentStreak} ngày
              </p>
            )}
          </>
        ) : (
          <>
            <div className="mb-4 text-5xl">✅</div>
            <h2 className="font-heading text-xl font-bold text-primary">
              Ngày {day} hoàn thành!
            </h2>
            <p className="mt-2 text-neutral-600">
              Tiếp tục với các bài tập khác nhé!
            </p>
            {currentStreak > 0 && (
              <p className="mt-4 text-sm font-medium text-primary">
                Streak: 🔥 {currentStreak} ngày
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
