"use client";

import { useCallback, useEffect, useState } from "react";

export default function AdminSettingsPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error("Không tải được cài đặt.");
      const data = await res.json();
      setEnabled(!!data.buddy_matching_enabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async () => {
    if (enabled === null || saving) return;
    const next = !enabled;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buddy_matching_enabled: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không lưu được.");
      setEnabled(!!data.buddy_matching_enabled);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-heading text-2xl font-bold text-primary">Settings</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Cài đặt toàn hệ thống. Thay đổi có hiệu lực ngay cho mọi user.
      </p>

      <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-heading text-base font-semibold text-primary">
              Ghép cặp buddy
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Bật thì hệ thống mới ghép cặp buddy – cả ghép tự động khi cohort
              khai giảng lẫn khi user tự chọn người đồng hành. Tắt thì KHÔNG ghép
              ai, user giữ trạng thái &ldquo;chưa ghép&rdquo; và ô tìm buddy được
              ẩn khỏi dashboard.
            </p>

            <p className="mt-3 text-sm">
              Trạng thái hiện tại:{" "}
              {loading || enabled === null ? (
                <span className="text-neutral-500">đang tải…</span>
              ) : enabled ? (
                <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-0.5 font-semibold text-success">
                  ĐANG BẬT
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-neutral-200 px-2.5 py-0.5 font-semibold text-neutral-700">
                  ĐANG TẮT
                </span>
              )}
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={enabled ?? false}
            aria-label="Bật/tắt ghép cặp buddy"
            onClick={toggle}
            disabled={loading || saving || enabled === null}
            className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
              enabled ? "bg-primary" : "bg-neutral-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {saving && (
          <p className="mt-3 text-sm text-neutral-600">Đang lưu…</p>
        )}
        {saved && !saving && !error && (
          <p className="mt-3 text-sm text-success">Đã lưu.</p>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </section>
    </div>
  );
}
