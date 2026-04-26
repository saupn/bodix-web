"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { MILESTONE_CONFIG } from "@/lib/completion/milestones";

const FATIGUE_EMOJI = ["😩", "😫", "😐", "😊", "💪"];
const PROGRESS_EMOJI = ["😔", "🤔", "🙂", "😄", "🤩"];
const ADJUSTMENT_ICON: Record<string, string> = {
  increase: "💪",
  maintain: "✅",
  decrease: "🌿",
};

interface ProgramData {
  enrollment: { id: string; started_at: string | null };
  program: { name: string };
  program_day: number;
  total_days: number;
}

interface WeeklyReview {
  id: string;
  week_number: number;
  fatigue_level: number;
  progress_feeling: number;
  difficulty_rating: number;
  system_suggestion: string | null;
  intensity_adjustment: string | null;
  submitted_at: string;
}

interface Milestone {
  milestone_type: string;
  achieved_at: string;
}

interface ProgressPhoto {
  id: string;
  photo_type: string;
  signed_url: string | null;
  week_number: number | null;
  uploaded_at: string;
}

interface TimelineItem {
  type: "start" | "weekly" | "milestone" | "midprogram" | "photo" | "current";
  date: string;
  label: string;
  detail?: string;
  week?: number;
  review?: WeeklyReview;
  milestone?: Milestone;
  photo?: ProgressPhoto;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function ReviewHistoryPage() {
  const [programData, setProgramData] = useState<ProgramData | null>(null);
  const [reviews, setReviews] = useState<WeeklyReview[]>([]);
  const [trend, setTrend] = useState<{
    fatigue_trend: { week: number; value: number }[];
    progress_trend: { week: number; value: number }[];
    difficulty_trend: { week: number; value: number }[];
  }>({ fatigue_trend: [], progress_trend: [], difficulty_trend: [] });
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [midProgram, setMidProgram] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const [zoomPhoto, setZoomPhoto] = useState<ProgressPhoto | null>(null);
  const [comparePhotos, setComparePhotos] = useState<ProgressPhoto[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const progRes = await fetch("/api/program/active");
        if (!progRes.ok) {
          setLoading(false);
          return;
        }
        const prog = await progRes.json();
        const enrollmentId = prog.enrollment?.id;
        if (!enrollmentId) {
          setLoading(false);
          return;
        }

        setProgramData({
          enrollment: prog.enrollment,
          program: prog.program ?? { name: "Chương trình" },
          program_day: prog.program_day ?? prog.enrollment?.current_day ?? 0,
          total_days: prog.total_days ?? 21,
        });

        const [reviewsRes, statsRes, photosRes, midRes] = await Promise.all([
          fetch(`/api/reviews/weekly?enrollment_id=${enrollmentId}`),
          fetch("/api/completion/my-stats"),
          fetch(`/api/photos?enrollment_id=${enrollmentId}`),
          fetch(`/api/reviews/mid-program?enrollment_id=${enrollmentId}`),
        ]);

        if (reviewsRes.ok) {
          const r = await reviewsRes.json();
          setReviews(r.reviews ?? []);
          setTrend({
            fatigue_trend: r.trend?.fatigue_trend ?? [],
            progress_trend: r.trend?.progress_trend ?? [],
            difficulty_trend: r.trend?.difficulty_trend ?? [],
          });
        }
        if (statsRes.ok) {
          const s = await statsRes.json();
          setMilestones(s.milestones ?? []);
        }
        if (photosRes.ok) {
          const p = await photosRes.json();
          setPhotos(p.photos ?? []);
        }
        if (midRes.ok) {
          const m = await midRes.json();
          setMidProgram(m.reflection ? { id: m.reflection.id } : null);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-neutral-500">Đang tải...</p>
      </div>
    );
  }

  if (!programData) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-neutral-200 bg-white p-6 text-center">
        <p className="text-neutral-600">Bạn chưa có chương trình đang hoạt động.</p>
        <Link href="/app/program" className="mt-4 inline-block font-medium text-primary">
          Xem chương trình →
        </Link>
      </div>
    );
  }

  const startDate = programData.enrollment.started_at?.slice(0, 10) ?? "";
  const programName = programData.program.name;
  const currentDay = programData.program_day;
  const totalDays = programData.total_days;

  const timeline: TimelineItem[] = [];

  if (startDate) {
    timeline.push({
      type: "start",
      date: startDate,
      label: `🚀 Bắt đầu hành trình ${programName}`,
    });
  }

  const milestoneByDate = new Map(milestones.map((m) => [m.achieved_at.slice(0, 10), m]));
  const photosByWeek = new Map<number, ProgressPhoto[]>();
  const beforePhotos = photos.filter((p) => p.photo_type === "before");
  const afterPhotos = photos.filter((p) => p.photo_type === "after");
  const midpointPhotos = photos.filter((p) => p.photo_type === "midpoint");
  for (const p of photos) {
    if (p.week_number != null) {
      if (!photosByWeek.has(p.week_number)) photosByWeek.set(p.week_number, []);
      photosByWeek.get(p.week_number)!.push(p);
    }
  }

  for (const r of reviews) {
    const weekStartDate = startDate ? addDays(startDate, (r.week_number - 1) * 7) : r.submitted_at.slice(0, 10);
    timeline.push({
      type: "weekly",
      date: weekStartDate,
      label: `📝 Tuần ${r.week_number}: Mệt ${FATIGUE_EMOJI[r.fatigue_level - 1] ?? "😐"}, Tiến bộ ${PROGRESS_EMOJI[r.progress_feeling - 1] ?? "🙂"}`,
      week: r.week_number,
      review: r,
    });

    const weekPhotos = photosByWeek.get(r.week_number);
    if (weekPhotos?.length) {
      for (const ph of weekPhotos) {
        timeline.push({
          type: "photo",
          date: ph.uploaded_at.slice(0, 10),
          label: "📸 Ảnh tiến bộ",
          photo: ph,
        });
      }
    }
  }

  if (midProgram && startDate) {
    const halfwayDay = Math.ceil(totalDays / 2);
    const midDate = addDays(startDate, halfwayDay - 1);
    timeline.push({
      type: "midprogram",
      date: midDate,
      label: "🎯 Nhìn lại nửa đường",
    });
  }

  for (const m of milestones) {
    const d = m.achieved_at.slice(0, 10);
    const config = MILESTONE_CONFIG[m.milestone_type];
    timeline.push({
      type: "milestone",
      date: d,
      label: `🏆 ${config?.label ?? m.milestone_type}`,
      milestone: m,
    });
  }

  for (const p of midpointPhotos) {
    if (!photosByWeek.get(p.week_number ?? 0)?.some((ph) => ph.id === p.id)) {
      timeline.push({
        type: "photo",
        date: p.uploaded_at.slice(0, 10),
        label: "📸 Ảnh giữa chương trình",
        photo: p,
      });
    }
  }

  if (beforePhotos.length) {
    for (const p of beforePhotos) {
      timeline.push({
        type: "photo",
        date: p.uploaded_at.slice(0, 10),
        label: "📸 Ảnh Ngày 1",
        photo: p,
      });
    }
  }
  if (afterPhotos.length) {
    for (const p of afterPhotos) {
      timeline.push({
        type: "photo",
        date: p.uploaded_at.slice(0, 10),
        label: "📸 Ảnh Kết thúc",
        photo: p,
      });
    }
  }

  timeline.sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    const order = { start: 0, weekly: 1, milestone: 2, midprogram: 3, photo: 4, current: 5 };
    return (order[a.type] ?? 9) - (order[b.type] ?? 9);
  });

  timeline.push({
    type: "current",
    date: new Date().toISOString().slice(0, 10),
    label: `📍 Ngày ${currentDay}/${totalDays} – Đang ở đây`,
  });

  const chartData = Array.from(
    new Set([
      ...trend.fatigue_trend.map((t) => t.week),
      ...trend.progress_trend.map((t) => t.week),
      ...trend.difficulty_trend.map((t) => t.week),
    ])
  )
    .sort((a, b) => a - b)
    .map((week) => {
      const f = trend.fatigue_trend.find((t) => t.week === week);
      const p = trend.progress_trend.find((t) => t.week === week);
      const d = trend.difficulty_trend.find((t) => t.week === week);
      return {
        week: `Tuần ${week}`,
        weekNum: week,
        Mệt_mỏi: f?.value ?? null,
        Tiến_bộ: p?.value ?? null,
        Độ_khó: d?.value ?? null,
      };
    })
    .filter((r) => r.Mệt_mỏi != null || r.Tiến_bộ != null || r.Độ_khó != null);

  const suggestions = reviews
    .filter((r) => r.system_suggestion)
    .map((r) => ({
      week: r.week_number,
      suggestion: r.system_suggestion!,
      adjustment: r.intensity_adjustment,
    }));

  const sortedPhotos = [...photos].sort((a, b) =>
    (a.uploaded_at ?? "").localeCompare(b.uploaded_at ?? "")
  );
  const photoOrder = ["before", "weekly", "midpoint", "after"];
  const sortedByType = sortedPhotos.sort((a, b) => {
    const ai = photoOrder.indexOf(a.photo_type);
    const bi = photoOrder.indexOf(b.photo_type);
    if (ai !== bi) return ai - bi;
    return (a.week_number ?? 0) - (b.week_number ?? 0);
  });

  const toggleCompare = (photo: ProgressPhoto) => {
    setComparePhotos((prev) => {
      const exists = prev.find((p) => p.id === photo.id);
      if (exists) return prev.filter((p) => p.id !== photo.id);
      if (prev.length >= 2) return [prev[1], photo];
      return [...prev, photo];
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-10 px-4 pb-16 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-primary">
          Lịch sử review & Tiến bộ
        </h1>
        <Link
          href="/app/review/weekly"
          className="text-sm font-medium text-primary hover:underline"
        >
          Review tuần mới →
        </Link>
      </div>

      {/* Section 1 — Progress Timeline */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="mb-6 font-heading text-lg font-semibold text-primary">
          Progress Timeline
        </h2>
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-neutral-200" />
          <ul className="space-y-6">
            {timeline.map((item, i) => (
              <motion.li
                key={`${item.type}-${item.date}-${i}`}
                className="relative flex gap-4 pl-10"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <div className="absolute left-2 top-1.5 h-4 w-4 rounded-full bg-primary" />
                <div className="min-w-0 flex-1 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3">
                  <p className="text-xs text-neutral-500">{item.date}</p>
                  <p className="mt-1 font-medium text-neutral-800">{item.label}</p>
                  {item.type === "photo" && item.photo?.signed_url && (
                    <img
                      src={item.photo.signed_url}
                      alt=""
                      className="mt-2 h-16 w-16 cursor-pointer rounded object-cover"
                      onClick={() => setZoomPhoto(item.photo!)}
                    />
                  )}
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      </section>

      {/* Section 2 — Trend Chart */}
      {chartData.length > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 font-heading text-lg font-semibold text-primary">
            Biểu đồ xu hướng
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis domain={[1, 5]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="Mệt_mỏi"
                  name="Mệt mỏi"
                  stroke="#ef4444"
                  strokeWidth={2}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="Tiến_bộ"
                  name="Tiến bộ"
                  stroke="#22c55e"
                  strokeWidth={2}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="Độ_khó"
                  name="Độ khó"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Section 3 — Photo Gallery */}
      {sortedByType.length > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 font-heading text-lg font-semibold text-primary">
            Gallery ảnh tiến bộ
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {sortedByType.map((photo) => (
              <div key={photo.id} className="relative">
                <img
                  src={photo.signed_url ?? ""}
                  alt=""
                  className="aspect-square w-full cursor-pointer rounded-lg object-cover"
                  onClick={() => setZoomPhoto(photo)}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCompare(photo);
                  }}
                  className={`absolute right-2 top-2 rounded px-2 py-1 text-xs ${
                    comparePhotos.some((p) => p.id === photo.id)
                      ? "bg-primary text-white"
                      : "bg-black/50 text-white"
                  }`}
                >
                  So sánh
                </button>
                <p className="mt-1 text-center text-xs text-neutral-500">
                  {photo.photo_type === "before" && "Ngày 1"}
                  {photo.photo_type === "after" && "Kết thúc"}
                  {photo.photo_type === "midpoint" && (photo.week_number ? `Giữa tuần ${photo.week_number}` : "Giữa chương trình")}
                  {photo.photo_type === "weekly" && `Tuần ${photo.week_number}`}
                </p>
              </div>
            ))}
          </div>

          {comparePhotos.length === 2 && (
            <div className="mt-6 grid grid-cols-2 gap-4 rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
              <div>
                <p className="mb-2 text-center text-sm font-medium">Ảnh 1</p>
                <img
                  src={comparePhotos[0].signed_url ?? ""}
                  alt=""
                  className="aspect-square w-full rounded-lg object-cover"
                />
              </div>
              <div>
                <p className="mb-2 text-center text-sm font-medium">Ảnh 2</p>
                <img
                  src={comparePhotos[1].signed_url ?? ""}
                  alt=""
                  className="aspect-square w-full rounded-lg object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => setComparePhotos([])}
                className="col-span-2 rounded border py-2 text-sm"
              >
                Đóng so sánh
              </button>
            </div>
          )}
        </section>
      )}

      {/* Section 4 — Suggestions History */}
      {suggestions.length > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 font-heading text-lg font-semibold text-primary">
            System Suggestions History
          </h2>
          <ul className="space-y-3">
            {suggestions.map((s) => (
              <li
                key={s.week}
                className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-3"
              >
                <span className="font-medium">Tuần {s.week}:</span>{" "}
                <span className="text-neutral-700">
                  {ADJUSTMENT_ICON[s.adjustment ?? ""] ?? "💡"} {s.suggestion}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Zoom modal */}
      {zoomPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoomPhoto(null)}
        >
          <img
            src={zoomPhoto.signed_url ?? ""}
            alt=""
            className="max-h-[90vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
