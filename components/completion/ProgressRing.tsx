"use client";

import { useEffect, useState } from "react";

interface ProgressRingProps {
  completedDays: number;
  totalDays: number;
  rate: number;
}

function getRateColor(rate: number): string {
  if (rate < 30) return "stroke-red-400";
  if (rate < 50) return "stroke-amber-400";
  if (rate < 80) return "stroke-success";
  return "stroke-primary";
}

export function ProgressRing({
  completedDays,
  totalDays,
  rate,
}: ProgressRingProps) {
  const [displayRate, setDisplayRate] = useState(0);

  useEffect(() => {
    const target = Math.round(rate);
    const duration = 800;
    const steps = 20;
    const stepMs = duration / steps;
    const increment = target / steps;
    let current = 0;
    const id = setInterval(() => {
      current += increment;
      if (current >= target) {
        setDisplayRate(target);
        clearInterval(id);
      } else {
        setDisplayRate(Math.round(current));
      }
    }, stepMs);
    return () => clearInterval(id);
  }, [rate]);

  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (displayRate / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-28 w-28">
        <svg
          className="-rotate-90"
          width="112"
          height="112"
          viewBox="0 0 112 112"
          aria-hidden
        >
          <circle
            cx="56"
            cy="56"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-neutral-200"
          />
          <circle
            cx="56"
            cy="56"
            r="45"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={`${getRateColor(rate)} transition-[stroke-dashoffset] duration-300`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-2xl font-bold text-primary">
            {displayRate}%
          </span>
        </div>
      </div>
      <span className="mt-2 text-sm text-neutral-600">
        {completedDays}/{totalDays} ngày
      </span>
    </div>
  );
}
