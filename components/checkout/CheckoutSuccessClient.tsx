"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface CheckoutSuccessClientProps {
  programName: string;
  cohortName: string;
  startDate: string;
}

function ConfettiCelebration() {
  const colors = ["#2D4A3E", "#C4785A", "#7CB083", "#E8DFD0"];
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          className="absolute h-2 w-2 animate-confetti-fall rounded-full opacity-80"
          style={{
            left: `${(i * 3.3) % 100}%`,
            top: "-10px",
            backgroundColor: colors[i % colors.length],
            animationDelay: `${i * 40}ms`,
            animationDuration: "2.5s",
          }}
        />
      ))}
    </div>
  );
}

export function CheckoutSuccessClient({
  programName,
  cohortName,
  startDate,
}: CheckoutSuccessClientProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="relative mx-auto max-w-lg space-y-6 text-center">
      {mounted && <ConfettiCelebration />}

      <div className="relative flex justify-center">
        <div className="flex h-24 w-24 animate-success-pop items-center justify-center rounded-full bg-success/20 text-5xl">
          🎉
        </div>
      </div>

      <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
        Chúc mừng! Bạn đã đăng ký {programName}
      </h1>

      <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6 text-left">
        <p className="font-medium text-primary">
          Đợt của bạn: {cohortName}
        </p>
        <p className="mt-2 text-neutral-600">
          Ngày bắt đầu: {startDate}
        </p>
      </div>

      <p className="text-neutral-600">
        Chuẩn bị tinh thần nhé! Bạn sẽ nhận thông báo khi đợt tập bắt đầu.
      </p>

      <Link
        href="/app"
        className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 font-medium text-secondary-light transition-colors hover:bg-primary-dark"
      >
        Về trang chủ
      </Link>
    </div>
  );
}
