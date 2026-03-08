"use client";

import { useEffect, useRef, useState } from "react";
import { MILESTONE_CONFIG } from "@/lib/completion/milestones";

export interface Milestone {
  milestone_type: string;
  achieved_at?: string;
}

interface MilestoneToastProps {
  milestones: Milestone[];
  onDismiss?: () => void;
  durationMs?: number;
}

export function MilestoneToast({
  milestones,
  onDismiss,
  durationMs = 5000,
}: MilestoneToastProps) {
  const [visible, setVisible] = useState(true);
  const [stack, setStack] = useState<Milestone[]>(milestones);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (milestones.length === 0) return;
    setStack((prev) => {
      const seen = new Set(prev.map((m) => m.milestone_type));
      const newOnes = milestones.filter((m) => !seen.has(m.milestone_type));
      return [...prev, ...newOnes];
    });
    setVisible(true);
  }, [milestones]);

  useEffect(() => {
    if (stack.length === 0) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        setStack([]);
        onDismiss?.();
      }, 300);
    }, durationMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [stack.length, durationMs, onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => {
      setStack([]);
      onDismiss?.();
    }, 300);
  };

  const removeOne = (milestone_type: string) => {
    setStack((prev) => {
      const next = prev.filter((m) => m.milestone_type !== milestone_type);
      if (next.length === 0) {
        setTimeout(handleDismiss, 0);
      }
      return next;
    });
  };

  if (stack.length === 0) return null;

  return (
    <div
      className={`fixed right-4 top-4 z-50 flex max-w-sm flex-col gap-3 transition-all duration-300 ease-out ${
        visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      }`}
      role="status"
      aria-live="polite"
    >
      {stack.map((m, i) => {
        const config = MILESTONE_CONFIG[m.milestone_type];
        if (!config) return null;
        return (
          <div
            key={`${m.milestone_type}-${i}`}
            className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-lg"
          >
            <span className="text-3xl">{config.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="font-heading font-semibold text-primary">
                {config.label}
              </p>
              <p className="mt-0.5 text-sm text-neutral-600">
                {config.description}
              </p>
              <button
                type="button"
                onClick={() => removeOne(m.milestone_type)}
                className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-secondary-light transition-colors hover:bg-primary-dark"
              >
                Tuyệt!
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
