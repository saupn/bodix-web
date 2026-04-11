"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function formatDdMmYyyy(isoDate: string): string {
  const [y, m, d] = isoDate.split("T")[0].split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

export function NextCohortBanner() {
  const [label, setLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/cohorts/upcoming", { cache: "no-store" });
        const json = (await res.json()) as {
          cohort?: { name?: string; start_date?: string } | null;
        };
        if (cancelled) return;
        const c = json.cohort;
        if (c?.start_date) {
          setLabel(
            `📅 Đợt tập tiếp theo: ${formatDdMmYyyy(c.start_date)}`
          );
        } else {
          setLabel(null);
        }
      } catch {
        if (!cancelled) setLabel(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;

  return (
    <div className="rounded-xl bg-[#2D4A3E]/10 p-6 text-center">
      {label ? (
        <>
          <p className="font-heading text-lg font-semibold text-[#2D4A3E]">{label}</p>
          <p className="mt-2 text-sm text-neutral-600">
            Đăng ký tập thử 3 ngày để giữ chỗ!
          </p>
          <Link
            href="/signup?program=bodix21"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-[#2D4A3E] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#243d32]"
          >
            Đăng ký tập thử →
          </Link>
        </>
      ) : (
        <p className="text-sm text-neutral-600">
          Đợt tập mới sắp mở — đăng ký để nhận thông báo!
        </p>
      )}
    </div>
  );
}
