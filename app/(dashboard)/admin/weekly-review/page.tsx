"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface Cohort {
  id: string;
  program_id: string;
  start_date: string;
  status: string;
  programs: { name: string } | null;
}

// ── Date helpers (lịch địa phương admin = VN) ──
function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function mondayOf(d: Date): Date {
  const dow = d.getDay(); // 0=CN..6=T7
  const offset = dow === 0 ? -6 : 1 - dow;
  const m = new Date(d);
  m.setDate(d.getDate() + offset);
  m.setHours(0, 0, 0, 0);
  return m;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(d.getDate() + n);
  return x;
}
function fmtDDMM(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function AdminWeeklyReviewPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [cohortId, setCohortId] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [qa, setQa] = useState("");
  const [video, setVideo] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Danh sách tuần: tuần trước, tuần này (mặc định) → 3 tuần tới (nhập trước).
  const weekOptions = useMemo(() => {
    const base = mondayOf(new Date());
    const opts: { value: string; label: string }[] = [];
    for (let i = -1; i <= 3; i++) {
      const mon = addDays(base, i * 7);
      const sat = addDays(mon, 5);
      const tag = i === 0 ? " (tuần này)" : i === 1 ? " (tuần sau)" : "";
      opts.push({
        value: toYmd(mon),
        label: `Tuần ${fmtDDMM(mon)} – ${fmtDDMM(sat)}${tag}`,
      });
    }
    return opts;
  }, []);

  // Load cohorts + default tuần này.
  useEffect(() => {
    setWeekStart(toYmd(mondayOf(new Date())));
    fetch("/api/admin/analytics/cohorts")
      .then((r) => r.json())
      .then((d) => {
        const list: Cohort[] = d.cohorts || [];
        setCohorts(list);
        const active = list.find((c) => c.status === "active") || list[0];
        if (active) setCohortId(active.id);
      })
      .catch(console.error);
  }, []);

  // Nạp nội dung đã lưu khi đổi cohort/tuần.
  const fetchContent = useCallback(() => {
    if (!cohortId || !weekStart) return;
    setLoading(true);
    setError(null);
    setSavedAt(null);
    fetch(
      `/api/admin/weekly-review?cohort_id=${cohortId}&week_start_date=${weekStart}`,
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          setQa("");
          setVideo("");
          return;
        }
        setQa(d.content?.qa_content ?? "");
        setVideo(d.content?.video_url ?? "");
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [cohortId, weekStart]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const handleSave = async () => {
    if (!cohortId || !weekStart) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/weekly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohort_id: cohortId,
          week_start_date: weekStart,
          qa_content: qa,
          video_url: video,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Lưu thất bại.");
      } else {
        setSavedAt(new Date().toLocaleTimeString("vi-VN"));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nội dung Review Chủ nhật</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Nhập Q&amp;A và link video cho tin Review gửi sáng Chủ nhật. Chọn tuần
          (theo thứ 2 đầu tuần) để nhập trước. Không nhập → tin vẫn hoàn chỉnh, bỏ
          phần đó.
        </p>
      </div>

      {/* Selectors */}
      <div className="flex flex-wrap gap-3">
        <select
          value={cohortId}
          onChange={(e) => setCohortId(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">Chọn cohort</option>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.programs?.name || "Program"} – {c.start_date}
              {c.status === "active" ? " (active)" : ""}
            </option>
          ))}
        </select>
        <select
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          {weekOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Form */}
      <div className="max-w-2xl space-y-4 rounded-lg border border-neutral-200 bg-white p-4">
        {loading ? (
          <p className="text-sm text-neutral-500">Đang tải nội dung...</p>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Giải đáp tuần này (Q&amp;A / tip)
              </label>
              <textarea
                value={qa}
                onChange={(e) => setQa(e.target.value)}
                rows={5}
                placeholder="VD: Hỏi: Đau gối khi squat có sao không? Đáp: ..."
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Link video Nhìn lại (tùy chọn)
              </label>
              <input
                type="text"
                value={video}
                onChange={(e) => setVideo(e.target.value)}
                placeholder="https://vimeo.com/..."
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {savedAt && (
              <p className="text-sm text-green-600">Đã lưu lúc {savedAt}.</p>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !cohortId || !weekStart}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : "Lưu"}
              </button>
              <span className="text-xs text-neutral-400">
                Lưu đè theo cohort + tuần đã chọn.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
