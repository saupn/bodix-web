"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Camera } from "lucide-react";

const VISIBLE_CHANGES = [
  "Giảm mỡ bụng",
  "Săn chắc đùi",
  "Săn chắc tay",
  "Tăng sức bền",
  "Ngủ ngon hơn",
  "Năng lượng hơn",
  "Tự tin hơn",
  "Quần áo vừa hơn",
  "Khác",
] as const;

const INTENSITY_OPTIONS = [
  { id: "more_hard" as const, label: "Tăng cường độ", emoji: "🔥" },
  { id: "keep_same" as const, label: "Giữ nguyên", emoji: "✅" },
  { id: "more_light" as const, label: "Nhẹ nhàng hơn", emoji: "🌿" },
];

interface ContextData {
  eligible: boolean;
  reason?: string;
  eligible_from?: string;
  eligible_until?: string;
  submitted?: boolean;
  enrollment_id?: string;
  current_day?: number;
  total_days?: number;
  halfway_day?: number;
  halfway_week?: number;
  original_goal?: string;
  before_photo_url?: string | null;
  midpoint_photo_url?: string | null;
  before_photo_path?: string | null;
  midpoint_photo_path?: string | null;
  existing_reflection?: Record<string, unknown>;
}

export default function MidProgramPage() {
  const [context, setContext] = useState<ContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [beforePhotoPath, setBeforePhotoPath] = useState<string | null>(null);
  const [beforePhotoPreview, setBeforePhotoPreview] = useState<string | null>(null);
  const [midpointPhotoPath, setMidpointPhotoPath] = useState<string | null>(null);
  const [midpointPhotoPreview, setMidpointPhotoPreview] = useState<string | null>(null);
  const [uploadingBefore, setUploadingBefore] = useState(false);
  const [uploadingMidpoint, setUploadingMidpoint] = useState(false);

  const [overallProgress, setOverallProgress] = useState(5);
  const [visibleChanges, setVisibleChanges] = useState<string[]>([]);
  const [goalStillRelevant, setGoalStillRelevant] = useState(true);
  const [updatedGoal, setUpdatedGoal] = useState("");
  const [wantsIntensity, setWantsIntensity] = useState<"more_hard" | "keep_same" | "more_light" | null>(null);
  const [whatWorksWell, setWhatWorksWell] = useState("");
  const [whatToImprove, setWhatToImprove] = useState("");
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [recommendationScore, setRecommendationScore] = useState<number | null>(null);

  const beforeInputRef = useRef<HTMLInputElement>(null);
  const midpointInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/reviews/mid-program/context")
      .then((r) => r.json())
      .then((data) => {
        setContext(data);
        if (data.before_photo_url) setBeforePhotoPreview(data.before_photo_url);
        if (data.midpoint_photo_url) setMidpointPhotoPreview(data.midpoint_photo_url);
        if (data.before_photo_path) setBeforePhotoPath(data.before_photo_path);
        if (data.midpoint_photo_path) setMidpointPhotoPath(data.midpoint_photo_path);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleUpload = async (
    type: "before" | "midpoint",
    file: File,
    enrollmentId: string,
    weekNumber?: number
  ) => {
    const setUploading = type === "before" ? setUploadingBefore : setUploadingMidpoint;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("enrollment_id", enrollmentId);
      formData.append("photo_type", type === "before" ? "before" : "midpoint");
      if (weekNumber) formData.append("week_number", String(weekNumber));

      const r = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData,
      });
      const data = await r.json();
      if (r.ok && data.photo_url) {
        if (type === "before") {
          setBeforePhotoPath(data.photo_url);
          setBeforePhotoPreview(data.signed_url ?? URL.createObjectURL(file));
        } else {
          setMidpointPhotoPath(data.photo_url);
          setMidpointPhotoPreview(data.signed_url ?? URL.createObjectURL(file));
        }
      } else {
        alert(data.error ?? "Upload thất bại.");
      }
    } finally {
      setUploading(false);
    }
  };

  const toggleVisibleChange = (c: string) => {
    setVisibleChanges((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const handleSubmit = async () => {
    if (
      !context?.enrollment_id ||
      wantsIntensity == null ||
      wouldRecommend == null ||
      recommendationScore == null
    ) {
      alert("Vui lòng điền đầy đủ các trường bắt buộc.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/reviews/mid-program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollment_id: context.enrollment_id,
          before_photo_url: beforePhotoPath ?? undefined,
          midpoint_photo_url: midpointPhotoPath ?? undefined,
          overall_progress: overallProgress,
          visible_changes: visibleChanges,
          goal_still_relevant: goalStillRelevant,
          updated_goal: goalStillRelevant ? undefined : updatedGoal.trim() || undefined,
          wants_intensity_change: wantsIntensity,
          what_works_well: whatWorksWell.trim() || undefined,
          what_to_improve: whatToImprove.trim() || undefined,
          would_recommend: wouldRecommend,
          recommendation_score: recommendationScore,
        }),
      });
      const data = await r.json();
      if (r.ok) {
        setSubmitted(true);
        setContext((prev) =>
          prev ? { ...prev, submitted: true, before_photo_url: beforePhotoPreview, midpoint_photo_url: midpointPhotoPreview } : prev
        );
      } else {
        alert(data.error ?? "Gửi thất bại.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-neutral-500">Đang tải...</p>
      </div>
    );
  }

  if (!context?.eligible) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <p className="text-neutral-600">
          {context?.reason === "no_enrollment"
            ? "Bạn chưa có chương trình đang hoạt động."
            : "Nhìn lại nửa hành trình chỉ khả dụng từ ngày " +
              (context?.eligible_from ?? "?") +
              " đến " +
              (context?.eligible_until ?? "?") +
              "."}
        </p>
        <Link href="/app/program" className="mt-4 inline-block font-medium text-primary">
          Về chương trình →
        </Link>
      </div>
    );
  }

  if (context.submitted && !submitted) {
    const existing = context.existing_reflection as Record<string, unknown> | undefined;
    return (
      <div className="mx-auto max-w-2xl px-4 pb-12 pt-6">
        <h1 className="font-heading text-2xl font-bold text-primary">
          🎯 Nhìn lại nửa hành trình
        </h1>
        <p className="mt-2 text-neutral-600">Bạn đã hoàn thành review này rồi.</p>
        {context.before_photo_url && context.midpoint_photo_url && (
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-neutral-200 overflow-hidden">
              <img
                src={context.before_photo_url}
                alt="Ngày 1"
                className="aspect-[3/4] w-full object-cover"
              />
              <p className="bg-neutral-50 p-2 text-center text-sm">Ngày 1</p>
            </div>
            <div className="rounded-xl border border-neutral-200 overflow-hidden">
              <img
                src={context.midpoint_photo_url}
                alt="Hôm nay"
                className="aspect-[3/4] w-full object-cover"
              />
              <p className="bg-neutral-50 p-2 text-center text-sm">Hôm nay</p>
            </div>
          </div>
        )}
        <Link
          href="/app/program"
          className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:bg-primary-dark"
        >
          Tiếp tục hành trình
        </Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-12 pt-6">
        <div className="rounded-xl border-2 border-green-300 bg-green-50 p-8 text-center">
          <p className="text-xl font-semibold text-green-800">
            Nửa đường xong! Nửa còn lại – cùng đi tiếp! 🚀
          </p>
        </div>
        {beforePhotoPreview && midpointPhotoPreview && (
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-neutral-200 overflow-hidden">
              <img
                src={beforePhotoPreview}
                alt="Ngày 1"
                className="aspect-[3/4] w-full object-cover"
              />
              <p className="bg-neutral-50 p-2 text-center text-sm">Ngày 1</p>
            </div>
            <div className="rounded-xl border border-neutral-200 overflow-hidden">
              <img
                src={midpointPhotoPreview}
                alt="Hôm nay"
                className="aspect-[3/4] w-full object-cover"
              />
              <p className="bg-neutral-50 p-2 text-center text-sm">Hôm nay</p>
            </div>
          </div>
        )}
        <Link
          href="/app/program"
          className="mt-8 inline-flex rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:bg-primary-dark"
        >
          Tiếp tục hành trình
        </Link>
      </div>
    );
  }

  const total = context.total_days ?? 0;
  const current = context.current_day ?? 0;
  const progressPct = total > 0 ? Math.min(100, (current / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      {/* Header */}
      <header className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-primary">
          🎯 Nhìn lại nửa hành trình
        </h1>
        <p className="mt-2 text-neutral-600">
          Bạn đã đi được {current}/{total} ngày – hơn nửa đường rồi!
        </p>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full rounded-full bg-primary transition-all duration-700"
            style={{ width: `${Math.max(50, progressPct)}%` }}
          />
        </div>
      </header>

      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-8">
        {/* Section 1 — Photos */}
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="font-heading font-semibold text-primary">
            So sánh ảnh
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-neutral-300 p-4">
              <p className="mb-2 text-sm font-medium">Ngày 1</p>
              {beforePhotoPreview ? (
                <div className="relative w-full">
                  <img
                    src={beforePhotoPreview}
                    alt="Ngày 1"
                    className="aspect-[3/4] w-full rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setBeforePhotoPreview(null);
                      setBeforePhotoPath(null);
                    }}
                    className="absolute right-2 top-2 rounded bg-black/50 px-2 py-1 text-xs text-white"
                  >
                    Xóa
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => beforeInputRef.current?.click()}
                  disabled={uploadingBefore || !context.enrollment_id}
                  className="flex aspect-[3/4] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 transition-colors hover:border-primary/50"
                >
                  <Camera className="h-10 w-10 text-neutral-400" />
                  <span className="mt-2 text-sm">
                    {uploadingBefore ? "Đang upload..." : "Upload ảnh ngày 1"}
                  </span>
                </button>
              )}
              <input
                ref={beforeInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && context.enrollment_id) handleUpload("before", f, context.enrollment_id);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-neutral-300 p-4">
              <p className="mb-2 text-sm font-medium">Hôm nay</p>
              {midpointPhotoPreview ? (
                <div className="relative w-full">
                  <img
                    src={midpointPhotoPreview}
                    alt="Hôm nay"
                    className="aspect-[3/4] w-full rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setMidpointPhotoPreview(null);
                      setMidpointPhotoPath(null);
                    }}
                    className="absolute right-2 top-2 rounded bg-black/50 px-2 py-1 text-xs text-white"
                  >
                    Xóa
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => midpointInputRef.current?.click()}
                  disabled={uploadingMidpoint || !context.enrollment_id || !context.halfway_week}
                  className="flex aspect-[3/4] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 transition-colors hover:border-primary/50"
                >
                  <Camera className="h-10 w-10 text-neutral-400" />
                  <span className="mt-2 text-sm">
                    {uploadingMidpoint ? "Đang upload..." : "Chụp ảnh hôm nay"}
                  </span>
                </button>
              )}
              <input
                ref={midpointInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && context.enrollment_id && context.halfway_week)
                    handleUpload("midpoint", f, context.enrollment_id, context.halfway_week);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            Ảnh chỉ bạn mới thấy. Bạn có thể chọn chia sẻ sau.
          </p>
        </section>

        {/* Section 2 — Progress */}
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="font-heading font-semibold text-primary">
            Đánh giá tiến bộ
          </h2>
          <p className="mt-4 font-medium text-neutral-800">
            Bạn đánh giá tiến bộ tổng thể thế nào?
          </p>
          <p className="mb-2 text-xs text-neutral-500">
            Chưa thay đổi ←→ Thay đổi rất lớn
          </p>
          <input
            type="range"
            min={1}
            max={10}
            value={overallProgress}
            onChange={(e) => setOverallProgress(parseInt(e.target.value, 10))}
            className="w-full accent-primary"
          />
          <p className="mt-1 text-center text-sm font-medium">{overallProgress}/10</p>

          <p className="mt-6 font-medium text-neutral-800">
            Bạn thấy thay đổi ở đâu?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {VISIBLE_CHANGES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleVisibleChange(c)}
                className={`rounded-full px-4 py-2 text-sm transition-colors ${
                  visibleChanges.includes(c)
                    ? "bg-primary text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </section>

        {/* Section 3 — Goal */}
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="font-heading font-semibold text-primary">
            Đánh giá lại mục tiêu
          </h2>
          <p className="mt-4 text-neutral-700">
            Mục tiêu ban đầu: <strong>{context.original_goal ?? "–"}</strong>
          </p>
          <p className="mt-4 font-medium text-neutral-800">
            Mục tiêu này vẫn đúng chứ?
          </p>
          <div className="mt-2 flex gap-4">
            <button
              type="button"
              onClick={() => setGoalStillRelevant(true)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                goalStillRelevant ? "bg-primary text-white" : "bg-neutral-100"
              }`}
            >
              Có
            </button>
            <button
              type="button"
              onClick={() => setGoalStillRelevant(false)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                !goalStillRelevant ? "bg-primary text-white" : "bg-neutral-100"
              }`}
            >
              Không
            </button>
          </div>
          {!goalStillRelevant && (
            <div className="mt-4">
              <label className="block text-sm font-medium">Mục tiêu mới của bạn?</label>
              <textarea
                value={updatedGoal}
                onChange={(e) => setUpdatedGoal(e.target.value)}
                placeholder="VD: Tập đủ 5 buổi/tuần, giảm 2kg..."
                rows={3}
                className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
          )}

          <p className="mt-6 font-medium text-neutral-800">
            Nửa còn lại, bạn muốn:
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {INTENSITY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setWantsIntensity(opt.id)}
                className={`flex flex-col items-center rounded-xl border-2 p-4 transition-colors ${
                  wantsIntensity === opt.id
                    ? "border-primary bg-primary/10"
                    : "border-neutral-200 hover:border-neutral-300"
                }`}
              >
                <span className="text-2xl">{opt.emoji}</span>
                <span className="mt-2 text-sm font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Section 4 — Feedback */}
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="font-heading font-semibold text-primary">Feedback</h2>
          <div className="mt-4">
            <label className="block font-medium text-neutral-800">
              Điều gì hiệu quả nhất với bạn?
            </label>
            <textarea
              value={whatWorksWell}
              onChange={(e) => setWhatWorksWell(e.target.value)}
              placeholder="VD: Bài tập ngắn, có video hướng dẫn..."
              rows={3}
              className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-4">
            <label className="block font-medium text-neutral-800">
              Điều gì cần cải thiện?
            </label>
            <textarea
              value={whatToImprove}
              onChange={(e) => setWhatToImprove(e.target.value)}
              placeholder="VD: Thêm bài cho người mới..."
              rows={3}
              className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <p className="mt-6 font-medium text-neutral-800">
            Bạn có giới thiệu BodiX cho bạn bè không?
          </p>
          <div className="mt-2 flex gap-4">
            <button
              type="button"
              onClick={() => setWouldRecommend(true)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                wouldRecommend === true ? "bg-primary text-white" : "bg-neutral-100"
              }`}
            >
              Có
            </button>
            <button
              type="button"
              onClick={() => setWouldRecommend(false)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                wouldRecommend === false ? "bg-primary text-white" : "bg-neutral-100"
              }`}
            >
              Không
            </button>
          </div>
          <p className="mt-6 font-medium text-neutral-800">
            Trên thang 0–10, bạn sẵn lòng giới thiệu BodiX bao nhiêu?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRecommendationScore(n)}
                className={`h-10 w-10 rounded-lg text-sm font-medium transition-colors ${
                  recommendationScore === n
                    ? "bg-primary text-white"
                    : "bg-neutral-100 hover:bg-neutral-200"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </section>

        <button
          type="submit"
          disabled={submitting || wantsIntensity == null || wouldRecommend == null || recommendationScore == null}
          className="w-full rounded-lg bg-primary py-3 font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {submitting ? "Đang gửi..." : "Hoàn thành review"}
        </button>
      </form>
    </div>
  );
}
