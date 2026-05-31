"use client";

import { useEffect, useState } from "react";
import { formatDateVn } from "@/lib/date/vietnam";

interface UpcomingCohort {
  id: string;
  name: string | null;
  start_date: string;
  program_id: string;
}

interface OtherCohortsLinkProps {
  /** Lọc cohort theo chương trình user đã enrolled. Bỏ trống → tất cả chương trình. */
  programId?: string | null;
  /** Cohort đang hiển thị ở phần trên (loại khỏi danh sách "đợt khác"). */
  currentCohortId?: string | null;
  /** start_date của cohort đang hiển thị — fallback loại trừ khi chưa gán cohort_id. */
  currentStartDate?: string | null;
}

/**
 * Hiển thị link nhỏ "Còn N đợt khác →" khi có >1 cohort upcoming, mở modal liệt
 * kê các đợt còn lại. Không render gì nếu chỉ có đúng 1 đợt (đợt đang hiển thị).
 */
export function OtherCohortsLink({
  programId,
  currentCohortId,
  currentStartDate,
}: OtherCohortsLinkProps) {
  const [others, setOthers] = useState<UpcomingCohort[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ list: "1" });
        if (programId) params.set("program_id", programId);
        const res = await fetch(`/api/cohorts/upcoming?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as { cohorts?: UpcomingCohort[] };
        if (cancelled) return;
        const list = json.cohorts ?? [];
        const rest = list.filter(
          (c) =>
            c.id !== currentCohortId &&
            (currentStartDate ? c.start_date !== currentStartDate : true),
        );
        // Nếu chưa biết cohort đang hiển thị (cả id lẫn start_date đều null),
        // server hiển thị đợt gần nhất (list[0]) → loại phần tử đầu.
        if (!currentCohortId && !currentStartDate && rest.length === list.length) {
          setOthers(rest.slice(1));
        } else {
          setOthers(rest);
        }
      } catch {
        /* ignore — link chỉ là bổ trợ */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [programId, currentCohortId, currentStartDate]);

  if (others.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
      >
        Còn {others.length} đợt khác →
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Các đợt tập sắp tới"
          >
            <div className="flex items-start justify-between">
              <h3 className="font-heading text-base font-semibold text-primary">
                Các đợt tập sắp tới
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="-mr-1 -mt-1 rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            <ul className="mt-4 space-y-2">
              {others.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2.5"
                >
                  <span className="font-medium text-neutral-800">
                    {formatDateVn(c.start_date)}
                  </span>
                  {c.name && (
                    <span className="ml-3 truncate text-sm text-neutral-500">
                      {c.name}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <p className="mt-4 text-xs text-neutral-500">
              Đây chỉ là danh sách tham khảo. Bạn đang giữ chỗ ở đợt hiển thị
              phía trên.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
