"use client";

import { useState, useEffect, useCallback } from "react";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface Question {
  id: string;
  enrollment_id: string;
  user_id: string;
  cohort_id: string;
  week_number: number;
  message_type: "text" | "image" | "video" | "voice";
  content: string | null;
  media_url: string | null;
  category: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  profiles: { full_name: string; channel_user_id: string } | null;
}

interface ReviewVideo {
  id: string;
  cohort_id: string;
  program_id: string | null;
  week_number: number;
  video_url: string;
  title: string;
  description: string | null;
  topics_covered: string[];
  duration_minutes: number | null;
  status: string;
  published_at: string | null;
  created_at: string;
  cohorts: { id: string; start_date: string; end_date: string; status: string } | null;
  programs: { name: string; slug: string } | null;
}

interface Cohort {
  id: string;
  program_id: string;
  start_date: string;
  end_date: string;
  status: string;
  programs: { name: string } | null;
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  form_check: { label: "Form", color: "bg-purple-100 text-purple-800" },
  pain_injury: { label: "Đau/Chấn thương", color: "bg-red-100 text-red-800" },
  nutrition: { label: "Dinh dưỡng", color: "bg-green-100 text-green-800" },
  motivation: { label: "Động lực", color: "bg-orange-100 text-orange-800" },
  schedule: { label: "Lịch tập", color: "bg-blue-100 text-blue-800" },
  other: { label: "Khác", color: "bg-neutral-100 text-neutral-800" },
};

const MESSAGE_TYPE_ICONS: Record<string, string> = {
  text: "📝",
  image: "🖼️",
  video: "🎬",
  voice: "🎤",
};

interface ExportStats {
  cohort_name: string;
  week_number: number;
  total_members: number;
  completed_5: number;
  completed_3_4: number;
  completed_1_2: number;
  completed_0: number;
  pct_5: number;
  pct_3_4: number;
  pct_1_2: number;
  pct_0: number;
  hard_rate: number;
  light_rate: number;
  easy_rate: number;
  avg_streak: number;
  max_streak: number;
  max_streak_user: string;
}

interface ExportQuestion {
  id: string;
  category: string;
  content: string | null;
  user_name: string;
  message_type: string;
  media_url: string | null;
}

interface ExportMedia {
  url: string;
  type: "image" | "video";
  user_name: string;
}

const CATEGORY_EMOJI: Record<string, string> = {
  form_check: "🟣",
  pain_injury: "🔴",
  nutrition: "🟢",
  motivation: "🟠",
  schedule: "🔵",
  other: "⚪",
};

const CATEGORY_LABEL_VN: Record<string, string> = {
  form_check: "FORM / TƯ THẾ",
  pain_injury: "ĐAU / CHẤN THƯƠNG",
  nutrition: "DINH DƯỠNG",
  motivation: "ĐỘNG LỰC",
  schedule: "LỊCH TẬP",
  other: "KHÁC",
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function AdminReviewsPage() {
  const [activeTab, setActiveTab] = useState<"questions" | "videos" | "direct" | "export">("questions");
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState<string>("");
  const [selectedWeek, setSelectedWeek] = useState<string>("");

  useEffect(() => {
    fetch("/api/admin/analytics/cohorts")
      .then((r) => r.json())
      .then((d) => {
        if (d.cohorts) setCohorts(d.cohorts);
      })
      .catch(console.error);
  }, []);

  const tabs = [
    { key: "questions" as const, label: "Vấn đề tuần này" },
    { key: "videos" as const, label: "Video Review" },
    { key: "direct" as const, label: "Trả lời riêng" },
    { key: "export" as const, label: "Dựng Video" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Review cuối tuần</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={selectedCohort}
          onChange={(e) => setSelectedCohort(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">Tất cả cohort</option>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.programs?.name || "Program"} – {c.start_date}
            </option>
          ))}
        </select>
        <select
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">Tất cả tuần</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={String(i + 1)}>
              Tuần {i + 1}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "questions" && (
        <QuestionsTab cohortId={selectedCohort} week={selectedWeek} />
      )}
      {activeTab === "videos" && (
        <VideosTab cohortId={selectedCohort} week={selectedWeek} cohorts={cohorts} />
      )}
      {activeTab === "direct" && (
        <DirectReplyTab cohortId={selectedCohort} week={selectedWeek} />
      )}
      {activeTab === "export" && (
        <VideoExportTab cohortId={selectedCohort} week={selectedWeek} cohorts={cohorts} />
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tab 1: Vấn đề tuần này
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function QuestionsTab({ cohortId, week }: { cohortId: string; week: string }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchQuestions = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (cohortId) params.set("cohort_id", cohortId);
    if (week) params.set("week", week);
    if (categoryFilter) params.set("category", categoryFilter);

    fetch(`/api/admin/reviews/questions?${params}`)
      .then((r) => r.json())
      .then((d) => setQuestions(d.questions || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [cohortId, week, categoryFilter]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const updateStatus = async (id: string, status: string) => {
    await fetch("/api/admin/reviews/questions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    fetchQuestions();
  };

  // Summary
  const total = questions.length;
  const pending = questions.filter((q) => q.status === "new").length;
  const byCat = Object.keys(CATEGORY_CONFIG).reduce(
    (acc, cat) => {
      acc[cat] = questions.filter((q) => q.category === cat).length;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <span>
            Tổng câu hỏi: <strong>{total}</strong>
          </span>
          <span>
            Chưa xử lý: <strong className="text-red-600">{pending}</strong>
          </span>
          {Object.entries(byCat)
            .filter(([, count]) => count > 0)
            .map(([cat, count]) => (
              <span key={cat}>
                {CATEGORY_CONFIG[cat]?.label}: <strong>{count}</strong>
              </span>
            ))}
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2">
        <button
          onClick={() => setCategoryFilter("")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            !categoryFilter ? "bg-primary text-white" : "bg-neutral-100 text-neutral-700"
          }`}
        >
          Tất cả
        </button>
        {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setCategoryFilter(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              categoryFilter === key ? "bg-primary text-white" : cfg.color
            }`}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-neutral-500">Đang tải...</p>
      ) : questions.length === 0 ? (
        <p className="text-sm text-neutral-500">Chưa có câu hỏi nào.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Ngày</th>
                <th className="px-3 py-2 text-left font-medium">Tên user</th>
                <th className="px-3 py-2 text-left font-medium">Loại</th>
                <th className="px-3 py-2 text-left font-medium">Danh mục</th>
                <th className="px-3 py-2 text-left font-medium">Nội dung</th>
                <th className="px-3 py-2 text-left font-medium">Media</th>
                <th className="px-3 py-2 text-left font-medium">Trạng thái</th>
                <th className="px-3 py-2 text-left font-medium">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {questions.map((q) => (
                <tr key={q.id} className="hover:bg-neutral-50">
                  <td className="whitespace-nowrap px-3 py-2">
                    {new Date(q.created_at).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-3 py-2">{q.profiles?.full_name || "–"}</td>
                  <td className="px-3 py-2">{MESSAGE_TYPE_ICONS[q.message_type] || "📝"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_CONFIG[q.category]?.color || "bg-neutral-100"}`}>
                      {CATEGORY_CONFIG[q.category]?.label || q.category}
                    </span>
                  </td>
                  <td className="max-w-xs truncate px-3 py-2">{q.content || "–"}</td>
                  <td className="px-3 py-2">
                    {q.media_url ? (
                      <a
                        href={q.media_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        Xem
                      </a>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        q.status === "new"
                          ? "bg-yellow-100 text-yellow-800"
                          : q.status === "reviewed"
                            ? "bg-blue-100 text-blue-800"
                            : q.status === "answered_in_video"
                              ? "bg-green-100 text-green-800"
                              : "bg-purple-100 text-purple-800"
                      }`}
                    >
                      {q.status === "new" ? "Mới" : q.status === "reviewed" ? "Đã xem" : q.status === "answered_in_video" ? "Trong video" : "Trả lời riêng"}
                    </span>
                  </td>
                  <td className="flex gap-1 px-3 py-2">
                    {q.status === "new" && (
                      <>
                        <button
                          onClick={() => updateStatus(q.id, "reviewed")}
                          className="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600"
                        >
                          Đã xem
                        </button>
                        <button
                          onClick={() => updateStatus(q.id, "answered_in_video")}
                          className="rounded bg-green-500 px-2 py-1 text-xs text-white hover:bg-green-600"
                        >
                          Trong video
                        </button>
                      </>
                    )}
                    {q.status === "reviewed" && (
                      <button
                        onClick={() => updateStatus(q.id, "answered_in_video")}
                        className="rounded bg-green-500 px-2 py-1 text-xs text-white hover:bg-green-600"
                      >
                        Trong video
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tab 2: Video Review
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function VideosTab({
  cohortId,
  week,
  cohorts,
}: {
  cohortId: string;
  week: string;
  cohorts: Cohort[];
}) {
  const [videos, setVideos] = useState<ReviewVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);

  // Form state
  const [formCohort, setFormCohort] = useState("");
  const [formWeek, setFormWeek] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formTopics, setFormTopics] = useState<string[]>([]);
  const [formDuration, setFormDuration] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchVideos = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (cohortId) params.set("cohort_id", cohortId);
    if (week) params.set("week", week);

    fetch(`/api/admin/reviews/videos?${params}`)
      .then((r) => r.json())
      .then((d) => setVideos(d.videos || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [cohortId, week]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const handleSaveDraft = async () => {
    if (!formCohort || !formWeek || !formUrl || !formTitle) return;
    setSaving(true);

    const cohort = cohorts.find((c) => c.id === formCohort);

    await fetch("/api/admin/reviews/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cohort_id: formCohort,
        program_id: cohort?.program_id || null,
        week_number: parseInt(formWeek),
        video_url: formUrl,
        title: formTitle,
        description: formDesc || null,
        topics_covered: formTopics,
        duration_minutes: formDuration ? parseInt(formDuration) : null,
      }),
    });

    // Reset form
    setFormUrl("");
    setFormTitle("");
    setFormDesc("");
    setFormTopics([]);
    setFormDuration("");
    setSaving(false);
    fetchVideos();
  };

  const handlePublish = async (videoId: string) => {
    if (!confirm("Xuất bản và gửi cho tất cả user trong cohort?")) return;
    setPublishing(videoId);

    const res = await fetch("/api/admin/reviews/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ review_video_id: videoId }),
    });
    const data = await res.json();

    if (data.ok) {
      alert(`Đã gửi cho ${data.sent} user (${data.errors} lỗi)`);
    } else {
      alert(`Lỗi: ${data.error}`);
    }

    setPublishing(null);
    fetchVideos();
  };

  const topicOptions = Object.keys(CATEGORY_CONFIG);

  const toggleTopic = (topic: string) => {
    setFormTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3">
        <h3 className="font-semibold">Tạo video review mới</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select
            value={formCohort}
            onChange={(e) => setFormCohort(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">Chọn cohort</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.programs?.name || "Program"} – {c.start_date}
              </option>
            ))}
          </select>
          <select
            value={formWeek}
            onChange={(e) => setFormWeek(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">Tuần số</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={String(i + 1)}>
                Tuần {i + 1}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={formUrl}
            onChange={(e) => setFormUrl(e.target.value)}
            placeholder="URL video (Vimeo embed URL)"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            type="text"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="Tiêu đề (VD: Review Tuần 1 – Cohort #3)"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <textarea
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
            placeholder="Mô tả ngắn"
            rows={2}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <div className="sm:col-span-2">
            <p className="mb-1 text-xs text-neutral-500">Chủ đề đã giải đáp:</p>
            <div className="flex flex-wrap gap-2">
              {topicOptions.map((topic) => (
                <button
                  key={topic}
                  onClick={() => toggleTopic(topic)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    formTopics.includes(topic)
                      ? "bg-primary text-white"
                      : CATEGORY_CONFIG[topic].color
                  }`}
                >
                  {CATEGORY_CONFIG[topic].label}
                </button>
              ))}
            </div>
          </div>
          <input
            type="number"
            value={formDuration}
            onChange={(e) => setFormDuration(e.target.value)}
            placeholder="Thời lượng (phút)"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSaveDraft}
            disabled={saving || !formCohort || !formWeek || !formUrl || !formTitle}
            className="rounded-lg bg-neutral-200 px-4 py-2 text-sm font-medium hover:bg-neutral-300 disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Lưu nháp"}
          </button>
        </div>
      </div>

      {/* Video list */}
      <div className="space-y-3">
        <h3 className="font-semibold">Danh sách video</h3>
        {loading ? (
          <p className="text-sm text-neutral-500">Đang tải...</p>
        ) : videos.length === 0 ? (
          <p className="text-sm text-neutral-500">Chưa có video nào.</p>
        ) : (
          <div className="space-y-3">
            {videos.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4"
              >
                <div className="space-y-1">
                  <p className="font-medium">{v.title}</p>
                  <p className="text-xs text-neutral-500">
                    Tuần {v.week_number} | {v.programs?.name || "–"} |{" "}
                    {v.duration_minutes ? `${v.duration_minutes} phút` : "–"}
                  </p>
                  {v.topics_covered?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {v.topics_covered.map((t) => (
                        <span
                          key={t}
                          className={`rounded-full px-2 py-0.5 text-xs ${CATEGORY_CONFIG[t]?.color || "bg-neutral-100"}`}
                        >
                          {CATEGORY_CONFIG[t]?.label || t}
                        </span>
                      ))}
                    </div>
                  )}
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      v.status === "draft"
                        ? "bg-yellow-100 text-yellow-800"
                        : v.status === "published"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-green-100 text-green-800"
                    }`}
                  >
                    {v.status === "draft" ? "Nháp" : v.status === "published" ? "Đã xuất bản" : "Đã gửi"}
                  </span>
                </div>
                <div className="flex gap-2">
                  {v.status === "draft" && (
                    <button
                      onClick={() => handlePublish(v.id)}
                      disabled={publishing === v.id}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                      {publishing === v.id ? "Đang gửi..." : "Xuất bản + Gửi"}
                    </button>
                  )}
                  <a
                    href={v.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50"
                  >
                    Xem video
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tab 3: Trả lời riêng
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function DirectReplyTab({ cohortId, week }: { cohortId: string; week: string }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const fetchQuestions = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (cohortId) params.set("cohort_id", cohortId);
    if (week) params.set("week", week);
    // Hiển thị pain_injury ưu tiên + tất cả status new/reviewed
    params.set("status", "new");

    fetch(`/api/admin/reviews/questions?${params}`)
      .then((r) => r.json())
      .then((d) => {
        const all = (d.questions || []) as Question[];
        // Ưu tiên pain_injury lên đầu
        all.sort((a: Question, b: Question) => {
          if (a.category === "pain_injury" && b.category !== "pain_injury") return -1;
          if (b.category === "pain_injury" && a.category !== "pain_injury") return 1;
          return 0;
        });
        setQuestions(all);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [cohortId, week]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleReply = async () => {
    if (!replyingId || !replyText.trim()) return;
    setSending(true);

    const res = await fetch("/api/admin/reviews/reply-direct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_id: replyingId, reply_text: replyText }),
    });
    const data = await res.json();

    if (data.ok) {
      setReplyingId(null);
      setReplyText("");
      fetchQuestions();
    } else {
      alert(`Lỗi: ${data.error}`);
    }
    setSending(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500">
        Câu hỏi cần trả lời trực tiếp (ưu tiên đau/chấn thương).
      </p>

      {loading ? (
        <p className="text-sm text-neutral-500">Đang tải...</p>
      ) : questions.length === 0 ? (
        <p className="text-sm text-neutral-500">Không có câu hỏi cần trả lời riêng.</p>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <div
              key={q.id}
              className="rounded-lg border border-neutral-200 bg-white p-4 space-y-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{q.profiles?.full_name || "User"}</p>
                  <p className="text-xs text-neutral-500">
                    {new Date(q.created_at).toLocaleString("vi-VN")} | Tuần {q.week_number}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_CONFIG[q.category]?.color || "bg-neutral-100"}`}>
                  {CATEGORY_CONFIG[q.category]?.label || q.category}
                </span>
              </div>
              <p className="text-sm">{q.content || "(media)"}</p>
              {q.media_url && (
                <a
                  href={q.media_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline"
                >
                  Xem media
                </a>
              )}

              {replyingId === q.id ? (
                <div className="space-y-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Nhập câu trả lời..."
                    rows={3}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleReply}
                      disabled={sending || !replyText.trim()}
                      className="rounded-lg bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                      {sending ? "Đang gửi..." : "Gửi qua OA"}
                    </button>
                    <button
                      onClick={() => {
                        setReplyingId(null);
                        setReplyText("");
                      }}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setReplyingId(q.id)}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
                >
                  Trả lời riêng
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tab 4: Dựng Video
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function VideoExportTab({
  cohortId,
  week,
  cohorts,
}: {
  cohortId: string;
  week: string;
  cohorts: Cohort[];
}) {
  const [exportCohort, setExportCohort] = useState(cohortId);
  const [exportWeek, setExportWeek] = useState(week);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ExportStats | null>(null);
  const [questions, setQuestions] = useState<ExportQuestion[]>([]);
  const [script, setScript] = useState("");
  const [media, setMedia] = useState<ExportMedia[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [previewMedia, setPreviewMedia] = useState<ExportMedia | null>(null);

  // Sync từ parent filters
  useEffect(() => {
    setExportCohort(cohortId);
  }, [cohortId]);
  useEffect(() => {
    setExportWeek(week);
  }, [week]);

  const fetchExport = useCallback(() => {
    if (!exportCohort || !exportWeek) return;
    setLoading(true);

    fetch(`/api/admin/reviews/export?cohort_id=${exportCohort}&week=${exportWeek}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setStats(null);
          setQuestions([]);
          setScript("");
          setMedia([]);
          return;
        }
        setStats(d.stats);
        setQuestions(d.questions || []);
        setScript(d.script_suggestion || "");
        setMedia(d.media || []);
        setSelectedQuestions(new Set());
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [exportCohort, exportWeek]);

  useEffect(() => {
    fetchExport();
  }, [fetchExport]);

  const copyToClipboard = async (text: string, section: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const toggleQuestion = (id: string) => {
    setSelectedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Build copy texts ──

  const buildSummaryText = () => {
    if (!stats) return "";
    return [
      `REVIEW TUẦN ${stats.week_number} – ${stats.cohort_name}`,
      `Số thành viên: ${stats.total_members}`,
      `Hoàn thành 5/5: ${stats.completed_5} người (${stats.pct_5}%)`,
      `Hoàn thành 3-4/5: ${stats.completed_3_4} người (${stats.pct_3_4}%)`,
      `Hoàn thành 1-2/5: ${stats.completed_1_2} người (${stats.pct_1_2}%)`,
      `Không tập: ${stats.completed_0} người (${stats.pct_0}%)`,
      `Tỷ lệ 3 lượt: ${stats.hard_rate}%`,
      `Tỷ lệ 2 lượt: ${stats.light_rate}%`,
      `Tỷ lệ 1 lượt: ${stats.easy_rate}%`,
      `Streak trung bình: ${stats.avg_streak} ngày`,
      `Streak cao nhất: ${stats.max_streak} ngày (${stats.max_streak_user})`,
    ].join("\n");
  };

  const buildAllQuestionsText = () => {
    const categoryOrder = ["form_check", "pain_injury", "nutrition", "motivation", "schedule", "other"];
    const textQuestions = questions.filter((q) => q.content);
    if (textQuestions.length === 0) return "Không có câu hỏi tuần này.";

    const lines: string[] = [`CÂU HỎI TUẦN NÀY (${textQuestions.length} câu)`];

    for (const cat of categoryOrder) {
      const catQs = textQuestions.filter((q) => q.category === cat);
      if (catQs.length === 0) continue;
      const emoji = CATEGORY_EMOJI[cat] || "⚪";
      const label = CATEGORY_LABEL_VN[cat] || cat;
      lines.push("");
      lines.push(`${emoji} ${label} (${catQs.length} câu):`);
      catQs.forEach((q, i) => {
        lines.push(`${i + 1}. "${q.content}" – ${q.user_name}`);
      });
    }

    return lines.join("\n");
  };

  const buildSelectedQuestionsText = () => {
    const selected = questions.filter((q) => selectedQuestions.has(q.id) && q.content);
    if (selected.length === 0) return "";
    return selected.map((q, i) => `${i + 1}. "${q.content}" – ${q.user_name}`).join("\n");
  };

  // ── Group questions by category ──
  const questionsByCategory = new Map<string, ExportQuestion[]>();
  for (const q of questions) {
    if (!q.content) continue;
    const cat = q.category || "other";
    const existing = questionsByCategory.get(cat) || [];
    existing.push(q);
    questionsByCategory.set(cat, existing);
  }

  const textQuestionCount = questions.filter((q) => q.content).length;

  if (!exportCohort || !exportWeek) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Chuẩn bị nội dung dựng video</h2>
        <div className="flex gap-3">
          <select
            value={exportCohort}
            onChange={(e) => setExportCohort(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">Chọn cohort</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.programs?.name || "Program"} – {c.start_date}
              </option>
            ))}
          </select>
          <select
            value={exportWeek}
            onChange={(e) => setExportWeek(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">Chọn tuần</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={String(i + 1)}>
                Tuần {i + 1}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-neutral-500">
          Vui lòng chọn cohort và tuần để xem nội dung dựng video.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Selectors */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">
          Chuẩn bị nội dung dựng video – Tuần {exportWeek}
        </h2>
        <select
          value={exportCohort}
          onChange={(e) => setExportCohort(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">Chọn cohort</option>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.programs?.name || "Program"} – {c.start_date}
            </option>
          ))}
        </select>
        <select
          value={exportWeek}
          onChange={(e) => setExportWeek(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">Chọn tuần</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={String(i + 1)}>
              Tuần {i + 1}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Đang tải dữ liệu...</p>
      ) : !stats ? (
        <p className="text-sm text-neutral-500">Không có dữ liệu.</p>
      ) : (
        <>
          {/* ── Phần A: Tóm tắt cohort ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">A. Tóm tắt cohort tuần này</h3>
              <button
                onClick={() => copyToClipboard(buildSummaryText(), "summary")}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"
              >
                {copiedSection === "summary" ? "Đã copy!" : "Copy"}
              </button>
            </div>
            <div className="rounded-lg bg-neutral-50 p-4 font-mono text-sm leading-relaxed">
              <p className="font-bold">
                REVIEW TUẦN {stats.week_number} – {stats.cohort_name}
              </p>
              <p>Số thành viên: {stats.total_members}</p>
              <p>
                Hoàn thành 5/5: {stats.completed_5} người ({stats.pct_5}%)
              </p>
              <p>
                Hoàn thành 3-4/5: {stats.completed_3_4} người ({stats.pct_3_4}%)
              </p>
              <p>
                Hoàn thành 1-2/5: {stats.completed_1_2} người ({stats.pct_1_2}%)
              </p>
              <p>
                Không tập: {stats.completed_0} người ({stats.pct_0}%)
              </p>
              <p>Tỷ lệ 3 lượt: {stats.hard_rate}%</p>
              <p>Tỷ lệ 2 lượt: {stats.light_rate}%</p>
              <p>Tỷ lệ 1 lượt: {stats.easy_rate}%</p>
              <p>Streak trung bình: {stats.avg_streak} ngày</p>
              <p>
                Streak cao nhất: {stats.max_streak} ngày ({stats.max_streak_user})
              </p>
            </div>
          </div>

          {/* ── Phần B: Câu hỏi theo danh mục ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                B. Câu hỏi theo danh mục ({textQuestionCount} câu)
              </h3>
              <div className="flex gap-2">
                {selectedQuestions.size > 0 && (
                  <button
                    onClick={() =>
                      copyToClipboard(buildSelectedQuestionsText(), "selected")
                    }
                    className="rounded-lg border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5"
                  >
                    {copiedSection === "selected"
                      ? "Đã copy!"
                      : `Copy ${selectedQuestions.size} câu đã chọn`}
                  </button>
                )}
                <button
                  onClick={() =>
                    copyToClipboard(buildAllQuestionsText(), "questions")
                  }
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"
                >
                  {copiedSection === "questions" ? "Đã copy!" : "Copy tất cả"}
                </button>
              </div>
            </div>

            {textQuestionCount === 0 ? (
              <p className="text-sm text-neutral-500">Không có câu hỏi tuần này.</p>
            ) : (
              <div className="space-y-4">
                {(
                  [
                    "form_check",
                    "pain_injury",
                    "nutrition",
                    "motivation",
                    "schedule",
                    "other",
                  ] as const
                ).map((cat) => {
                  const catQs = questionsByCategory.get(cat);
                  if (!catQs || catQs.length === 0) return null;
                  const emoji = CATEGORY_EMOJI[cat];
                  const label = CATEGORY_LABEL_VN[cat];

                  return (
                    <div key={cat}>
                      <p className="mb-1 text-sm font-semibold">
                        {emoji} {label} ({catQs.length} câu)
                      </p>
                      <div className="space-y-1">
                        {catQs.map((q, i) => (
                          <label
                            key={q.id}
                            className="flex items-start gap-2 rounded px-2 py-1 text-sm hover:bg-neutral-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedQuestions.has(q.id)}
                              onChange={() => toggleQuestion(q.id)}
                              className="mt-0.5 rounded border-neutral-300"
                            />
                            <span>
                              {i + 1}. &ldquo;{q.content}&rdquo; – {q.user_name}
                              {q.media_url && (
                                <a
                                  href={q.media_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-1 text-primary underline"
                                >
                                  ({MESSAGE_TYPE_ICONS[q.message_type] || "📎"} media)
                                </a>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Phần C: Script gợi ý ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">C. Script gợi ý cho video</h3>
              <button
                onClick={() => copyToClipboard(script, "script")}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"
              >
                {copiedSection === "script" ? "Đã copy!" : "Copy script"}
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              Script chỉ là gợi ý – hãy chỉnh sửa trước khi dựng video.
            </p>
            <div className="rounded-lg bg-blue-50 p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">
              {script || "Không có dữ liệu để tạo script."}
            </div>
          </div>

          {/* ── Phần D: Media từ user ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">D. Media từ user ({media.length})</h3>
              {media.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const links = media.map((m) => m.url).join("\n");
                      copyToClipboard(links, "media-links");
                    }}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"
                  >
                    {copiedSection === "media-links" ? "Đã copy!" : "Copy links"}
                  </button>
                </div>
              )}
            </div>

            {media.length === 0 ? (
              <p className="text-sm text-neutral-500">
                Không có media nào tuần này.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {media.map((m, i) => (
                  <div
                    key={i}
                    className="group relative cursor-pointer rounded-lg border border-neutral-200 bg-white overflow-hidden"
                    onClick={() => setPreviewMedia(m)}
                  >
                    {m.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.url}
                        alt={`Media from ${m.user_name}`}
                        className="h-32 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-32 items-center justify-center bg-neutral-100">
                        <span className="text-3xl">🎬</span>
                      </div>
                    )}
                    <div className="p-2">
                      <p className="truncate text-xs text-neutral-600">
                        {m.user_name}
                      </p>
                    </div>
                    <a
                      href={m.url}
                      download
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-1 top-1 rounded bg-black/50 px-1.5 py-0.5 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Download
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Media Preview Modal ── */}
          {previewMedia && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
              onClick={() => setPreviewMedia(null)}
            >
              <div
                className="relative max-h-[90vh] max-w-[90vw] rounded-lg bg-white p-2"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setPreviewMedia(null)}
                  className="absolute -right-2 -top-2 z-10 rounded-full bg-neutral-800 px-2 py-0.5 text-sm text-white hover:bg-neutral-700"
                >
                  &times;
                </button>
                {previewMedia.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewMedia.url}
                    alt={`Media from ${previewMedia.user_name}`}
                    className="max-h-[80vh] rounded object-contain"
                  />
                ) : (
                  <video
                    src={previewMedia.url}
                    controls
                    className="max-h-[80vh] rounded"
                  />
                )}
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-sm text-neutral-600">
                    {previewMedia.user_name}
                  </p>
                  <a
                    href={previewMedia.url}
                    download
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs text-white hover:bg-primary/90"
                  >
                    Download
                  </a>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
