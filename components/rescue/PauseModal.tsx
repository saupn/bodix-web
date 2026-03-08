"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

interface PauseModalProps {
  open: boolean;
  onClose: () => void;
  interventionId: string;
  onSuccess?: () => void;
}

type PauseDuration = "1_week" | "2_weeks" | "unsure" | null;

export function PauseModal({
  open,
  onClose,
  interventionId,
  onSuccess,
}: PauseModalProps) {
  const router = useRouter();
  const [duration, setDuration] = useState<PauseDuration>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/rescue/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intervention_id: interventionId,
          action: "pause",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Không thể tạm dừng.");
      }

      onClose();
      onSuccess?.();
      router.push("/app");
      router.refresh();
    } catch (e) {
      console.error("[PauseModal]", e);
      // Could add toast here
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-semibold text-primary">
            Tạm dừng chương trình
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-neutral-600">
          Bạn có thể quay lại bất cứ lúc nào. Tiến độ sẽ được giữ nguyên.
        </p>

        <div className="mt-6">
          <p className="text-sm font-medium text-neutral-700">
            Bạn muốn tạm dừng bao lâu?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { value: "1_week" as const, label: "1 tuần" },
              { value: "2_weeks" as const, label: "2 tuần" },
              { value: "unsure" as const, label: "Không chắc" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDuration(opt.value)}
                className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  duration === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-neutral-200 text-neutral-700 hover:border-neutral-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="rounded-xl bg-primary px-4 py-3 font-semibold text-secondary-light transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? "Đang xử lý..." : "Xác nhận tạm dừng"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-neutral-200 px-4 py-3 font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Thôi, tôi sẽ tiếp tục
          </button>
        </div>
      </div>
    </div>
  );
}
