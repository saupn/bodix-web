"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateVn } from "@/lib/date/vietnam";

export function TrialSignupCard({
  canTrial,
  hasEverTrialed,
  programId,
  nextCohortDate,
}: {
  canTrial: boolean;
  hasEverTrialed: boolean;
  programId: string | null;
  nextCohortDate: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartTrial = async () => {
    if (!programId || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/trial/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ program_id: programId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Có lỗi xảy ra. Vui lòng thử lại.");
        return;
      }

      router.push("/app/trial");
      router.refresh();
    } catch {
      setError("Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  // Already trialed — don't show card
  if (hasEverTrialed) return null;

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-white p-6 shadow-md sm:p-8">
      <h3 className="font-heading text-xl font-bold text-primary sm:text-2xl">
        BodiX 21 – 21 ngày thay đổi thật sự
      </h3>
      <p className="mt-3 text-neutral-600">
        Mỗi ngày chỉ 7-21 phút. Tập tại nhà, không cần dụng cụ.
        Bạn chọn cường độ phù hợp – cả 3 mức đều tính hoàn thành.
      </p>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={handleStartTrial}
          disabled={loading || !programId || !canTrial}
          className="w-full rounded-xl bg-primary px-6 py-4 text-base font-semibold text-secondary-light transition-colors hover:bg-primary-dark disabled:opacity-60 sm:w-auto"
        >
          {loading ? "Đang đăng ký..." : "Đăng ký tập thử 3 ngày (miễn phí)"}
        </button>
        {/* BD-FLEXIBLE-ENROLLMENT: thông tin cohort, KHÔNG chặn đăng ký. */}
        <p className="text-sm text-neutral-700 leading-relaxed">
          {nextCohortDate
            ? `Đợt tập gần nhất bắt đầu ${formatDateVn(nextCohortDate)} – bạn đăng ký lúc nào cũng được và sẽ vào đợt này. Nếu đăng ký sát ngày khai giảng, thời gian trải nghiệm có thể ngắn hơn 3 ngày.`
            : "Đợt tập tiếp theo đang được lên lịch, chúng tôi sẽ thông báo sớm. Bạn vẫn có thể bắt đầu trải nghiệm ngay."}
        </p>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>
    </div>
  );
}
