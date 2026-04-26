"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Toast } from "@/components/ui/Toast";

const CHANNEL_OPTIONS = [
  { value: "email", label: "📧 Email" },
  { value: "zalo", label: "💬 Zalo" },
  { value: "both", label: "📧💬 Cả hai" },
] as const;

const MORNING_OPTIONS = [
  "06:00",
  "06:30",
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
];

const EVENING_OPTIONS = [
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
  "22:00",
  "22:30",
  "23:00",
];

function normalizeTime(v: string | null | undefined): string {
  if (!v) return "07:00";
  const match = String(v).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "07:00";
  const h = match[1].padStart(2, "0");
  const m = match[2];
  return `${h}:${m}`;
}

interface Prefs {
  preferred_channel: "email" | "zalo" | "both";
  morning_reminder: boolean;
  evening_confirmation: boolean;
  rescue_messages: boolean;
  community_updates: boolean;
  morning_time: string;
  evening_time: string;
  phone_verified?: boolean;
}

const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  zalo: "Zalo",
  both: "Email và Zalo",
};

export default function NotificationsPage() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async (updates: Partial<Prefs>) => {
    const res = await fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setToast(data.error ?? "Không thể lưu.");
      return;
    }
    setToast("Đã lưu cài đặt thông báo");
  }, []);

  const debouncedSave = useCallback(
    (updates: Partial<Prefs>) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        save(updates);
      }, 1000);
    },
    [save]
  );

  const updatePref = useCallback(
    (updates: Partial<Prefs>) => {
      setPrefs((p) => (p ? { ...p, ...updates } : null));
      debouncedSave(updates);
    },
    [debouncedSave]
  );

  useEffect(() => {
    fetch("/api/notifications/preferences")
      .then((r) => r.json())
      .then((data) => {
        setPrefs({
          preferred_channel: data.preferred_channel ?? "email",
          morning_reminder: data.morning_reminder ?? true,
          evening_confirmation: data.evening_confirmation ?? true,
          rescue_messages: data.rescue_messages ?? true,
          community_updates: data.community_updates ?? true,
          morning_time: normalizeTime(data.morning_time),
          evening_time: normalizeTime(data.evening_time),
          phone_verified: data.phone_verified ?? false,
        });
      })
      .catch(() => setToast("Không tải được cài đặt."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  if (loading || !prefs) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-neutral-500">Đang tải...</p>
      </div>
    );
  }

  const channelNeedsPhone =
    (prefs.preferred_channel === "zalo" || prefs.preferred_channel === "both") &&
    !prefs.phone_verified;

  // Preview: estimate notifications per week
  let estPerWeek = 0;
  if (prefs.morning_reminder) estPerWeek += 7;
  if (prefs.evening_confirmation) estPerWeek += 4;
  if (prefs.rescue_messages) estPerWeek += 1;
  if (prefs.community_updates) estPerWeek += 1;

  return (
    <div className="mx-auto max-w-xl space-y-8 pb-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
          Cài đặt thông báo
        </h1>
        <p className="mt-2 text-neutral-600">
          Chọn cách BodiX nhắc bạn giữ nhịp tập luyện
        </p>
      </div>

      {/* Section 1 — Kênh nhận thông báo */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="font-heading text-base font-semibold text-primary">
          Kênh nhận thông báo
        </h2>
        <div className="mt-4 space-y-3">
          {CHANNEL_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                prefs.preferred_channel === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <input
                type="radio"
                name="channel"
                value={opt.value}
                checked={prefs.preferred_channel === opt.value}
                onChange={() => updatePref({ preferred_channel: opt.value })}
                className="h-4 w-4 text-primary"
              />
              <span className="font-medium text-neutral-800">{opt.label}</span>
            </label>
          ))}
        </div>
        {channelNeedsPhone && (
          <p className="mt-3 text-sm text-amber-600">
            <Link
              href="/onboarding"
              className="font-medium underline hover:no-underline"
            >
              Xác minh số điện thoại trước
            </Link>{" "}
            để nhận thông báo qua Zalo.
          </p>
        )}
      </section>

      {/* Section 2 — Loại thông báo */}
      <section className="space-y-4">
        <h2 className="font-heading text-base font-semibold text-primary">
          Loại thông báo
        </h2>

        {/* Morning Reminder */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-neutral-800">
                ☀️ Nhắc sáng (Morning Reminder)
              </p>
              <p className="mt-1 text-sm text-neutral-600">
                Nhắc nhẹ mỗi sáng về bài tập hôm nay
              </p>
            </div>
            <Toggle
              checked={prefs.morning_reminder}
              onChange={(v) => updatePref({ morning_reminder: v })}
            />
          </div>
          {prefs.morning_reminder && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-neutral-600">
                Giờ nhắc
              </label>
              <select
                value={
                  MORNING_OPTIONS.includes(prefs.morning_time)
                    ? prefs.morning_time
                    : "07:00"
                }
                onChange={(e) =>
                  updatePref({ morning_time: e.target.value })
                }
                className="mt-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {MORNING_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Evening Confirmation */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-neutral-800">
                🌙 Nhắc tối (Evening Confirmation)
              </p>
              <p className="mt-1 text-sm text-neutral-600">
                Nhắc check-in nếu bạn chưa tập
              </p>
            </div>
            <Toggle
              checked={prefs.evening_confirmation}
              onChange={(v) => updatePref({ evening_confirmation: v })}
            />
          </div>
          {prefs.evening_confirmation && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-neutral-600">
                Giờ nhắc
              </label>
              <select
                value={
                  EVENING_OPTIONS.includes(prefs.evening_time)
                    ? prefs.evening_time
                    : "21:00"
                }
                onChange={(e) =>
                  updatePref({ evening_time: e.target.value })
                }
                className="mt-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {EVENING_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Rescue Messages */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-neutral-800">
                🆘 Tin nhắn hỗ trợ (Rescue Messages)
              </p>
              <p className="mt-1 text-sm text-neutral-600">
                Nhận hỗ trợ khi bạn bỏ lỡ nhiều ngày
              </p>
              <p className="mt-2 text-xs font-medium text-primary">
                Khuyên bật – đây là tính năng giúp bạn không bỏ cuộc
              </p>
            </div>
            <Toggle
              checked={prefs.rescue_messages}
              onChange={(v) => updatePref({ rescue_messages: v })}
            />
          </div>
        </div>

        {/* Community Updates */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-neutral-800">
                👥 Cập nhật cộng đồng
              </p>
              <p className="mt-1 text-sm text-neutral-600">
                Cập nhật về đợt tập của bạn
              </p>
            </div>
            <Toggle
              checked={prefs.community_updates}
              onChange={(v) => updatePref({ community_updates: v })}
            />
          </div>
        </div>
      </section>

      {/* Section 3 — Preview */}
      <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm text-neutral-700">
          Bạn sẽ nhận khoảng{" "}
          <span className="font-semibold text-primary">{estPerWeek}</span>{" "}
          thông báo/tuần qua{" "}
          <span className="font-medium">
            {CHANNEL_LABEL[prefs.preferred_channel] ?? prefs.preferred_channel}
          </span>
        </p>
      </section>

      <Toast
        message={toast}
        open={!!toast}
        onClose={() => setToast("")}
      />
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-neutral-300"
      }`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "left-6" : "left-1"
        }`}
      />
    </button>
  );
}
