"use client";

import { useState } from "react";
import { X } from "lucide-react";

export const FEELING_OPTIONS = [
  { value: 1, label: "Rất mệt", emoji: "😤" },
  { value: 2, label: "Hơi mệt", emoji: "😅" },
  { value: 3, label: "Vừa phải", emoji: "😊" },
  { value: 4, label: "Tốt", emoji: "💪" },
  { value: 5, label: "Tuyệt vời", emoji: "🔥" },
] as const;

type TabMode = "hard" | "light" | "recovery";

interface CheckInModalProps {
  open: boolean;
  onClose: () => void;
  day: number;
  mode: TabMode;
  modeOptions: { key: TabMode; label: string }[];
  onSubmit: (params: {
    mode: TabMode;
    feeling: number;
    note?: string;
  }) => Promise<void>;
}

export function CheckInModal({
  open,
  onClose,
  day,
  mode,
  modeOptions,
  onSubmit,
}: CheckInModalProps) {
  const [feeling, setFeeling] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (feeling === null) return;
    setLoading(true);
    try {
      await onSubmit({ mode, feeling, note: note.trim() || undefined });
      onClose();
    } catch {
      // Error shown via toast; keep modal open
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
      <div className="relative w-full max-w-lg rounded-t-2xl bg-white shadow-xl sm:rounded-2xl sm:max-h-[90vh] sm:overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
          <h3 className="font-heading text-lg font-semibold text-primary">
            Check-in
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

        <div className="space-y-6 p-4 pb-8">
          {/* Mode confirmation */}
          <div>
            <p className="text-sm font-medium text-neutral-600">
              Chế độ đã chọn
            </p>
            <div className="mt-2 flex gap-2">
              {modeOptions.map((opt) => (
                <span
                  key={opt.key}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    mode === opt.key
                      ? "bg-primary text-secondary-light"
                      : "bg-neutral-100 text-neutral-500"
                  }`}
                >
                  {opt.label}
                </span>
              ))}
            </div>
          </div>

          {/* Feeling */}
          <div>
            <p className="mb-3 text-sm font-medium text-neutral-600">
              Cảm giác sau khi tập
            </p>
            <div className="flex justify-between gap-1">
              {FEELING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFeeling(opt.value)}
                  className={`flex flex-1 flex-col items-center rounded-xl border-2 px-2 py-3 transition-all ${
                    feeling === opt.value
                      ? "border-primary bg-primary/10"
                      : "border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <span className="mt-1 text-xs font-medium text-neutral-700">
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label
              htmlFor="checkin-note"
              className="block text-sm font-medium text-neutral-600"
            >
              Ghi chú hôm nay (tùy chọn)
            </label>
            <textarea
              id="checkin-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Cảm nhận, ghi chú..."
              rows={3}
              className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || feeling === null}
            className="w-full rounded-xl bg-primary px-4 py-4 text-base font-semibold text-secondary-light transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? "Đang xử lý..." : "Xác nhận hoàn thành"}
          </button>
        </div>
      </div>
    </div>
  );
}
