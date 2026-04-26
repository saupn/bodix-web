"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { VimeoPlayer } from "@/components/workout/VimeoPlayer";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReviewContent {
  review_video_url: string | null;
  review_video_title: string | null;
  review_video_duration: number | null;
  coach_note: string | null;
  next_week_focus: string | null;
}

interface WeekStats {
  completed_count: number;
  completion_rate: number;
  hard_count: number;
  light_count: number;
  recovery_count: number;
  avg_feeling: number | null;
  day_completed: boolean[];
}

interface ContextData {
  enrollment_id: string;
  week_number: number;
  pending: boolean;
  reason?: string;
  week_stats?: WeekStats;
  existing_review?: Record<string, unknown>;
}

type BodyArea =
  | "shoulders"
  | "upper_back"
  | "lower_back"
  | "core_area"
  | "glutes"
  | "quads"
  | "hamstrings"
  | "calves"
  | "arms";

const BODY_AREAS: { key: BodyArea; label: string }[] = [
  { key: "shoulders", label: "Vai" },
  { key: "upper_back", label: "Lưng trên" },
  { key: "lower_back", label: "Lưng dưới" },
  { key: "core_area", label: "Bụng" },
  { key: "glutes", label: "Mông" },
  { key: "quads", label: "Đùi trước" },
  { key: "hamstrings", label: "Đùi sau" },
  { key: "calves", label: "Bắp chân" },
  { key: "arms", label: "Tay" },
];

const BODY_STATUS_OPTIONS = [
  { value: 1, emoji: "😊", label: "Bình thường" },
  { value: 2, emoji: "😐", label: "Hơi mỏi" },
  { value: 3, emoji: "😣", label: "Căng đau" },
];

const ENERGY_OPTIONS = [
  { value: 1, emoji: "😩", label: "Rất mệt" },
  { value: 2, emoji: "😔", label: "Hơi mệt" },
  { value: 3, emoji: "😊", label: "Bình thường" },
  { value: 4, emoji: "💪", label: "Tốt" },
  { value: 5, emoji: "🔥", label: "Tuyệt vời" },
];

const PROGRESS_CHIPS = [
  "Sức mạnh tăng",
  "Sức bền tốt hơn",
  "Form chuẩn hơn",
  "Cơ thể thay đổi",
  "Ngủ ngon hơn",
  "Năng lượng hơn",
  "Tự tin hơn",
  "Quần áo vừa hơn",
  "Chưa thấy rõ",
];

const CHALLENGE_CARDS = [
  { id: "more_hard", emoji: "🔥", label: "Tăng số buổi Hard" },
  { id: "keep_same", emoji: "✅", label: "Giữ nhịp hiện tại" },
  { id: "slow_down", emoji: "🐢", label: "Tập chậm hơn, cảm nhận cơ" },
  { id: "less_rest", emoji: "⚡", label: "Giảm thời gian nghỉ" },
];

// ─── Confetti ────────────────────────────────────────────────────────────────

function ConfettiParticles() {
  const colors = ["#2D4A3E", "#C4785A", "#7CB083", "#E8DFD0", "#A78BFA"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 40 }).map((_, i) => (
        <div
          key={i}
          className="absolute h-2 w-2 animate-confetti-fall rounded-full opacity-90"
          style={{
            left: `${(i * 2.5) % 100}%`,
            top: "-10px",
            backgroundColor: colors[i % colors.length],
            animationDelay: `${i * 30}ms`,
            animationDuration: "2.5s",
          }}
        />
      ))}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SundayReviewPage() {
  const router = useRouter();

  // Data
  const [context, setContext] = useState<ContextData | null>(null);
  const [reviewContent, setReviewContent] = useState<ReviewContent | null>(null);
  const [stats, setStats] = useState<{
    streak: { current_streak: number; total_completed_days: number };
    completion_rate: number;
  } | null>(null);
  const [programSlug, setProgramSlug] = useState<string | null>(null);
  const [totalDays, setTotalDays] = useState(21);
  const [loading, setLoading] = useState(true);

  // Section state
  const [activeSection, setActiveSection] = useState(1);

  // Part 2 — Body scan
  const [bodyScores, setBodyScores] = useState<Record<BodyArea, number>>(
    Object.fromEntries(BODY_AREAS.map((a) => [a.key, 1])) as Record<BodyArea, number>
  );
  const [bodyNotes, setBodyNotes] = useState("");

  // Part 3 — Self-assessment
  const [energyLevel, setEnergyLevel] = useState(0);
  const [progressTags, setProgressTags] = useState<string[]>([]);
  const [challenge, setChallenge] = useState("");
  const [selfNote, setSelfNote] = useState("");

  // Part 4
  const [submitting, setSubmitting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // ── Load data ────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const [ctxRes, statsRes, progRes] = await Promise.all([
          fetch("/api/reviews/weekly/context"),
          fetch("/api/completion/my-stats"),
          fetch("/api/program/active"),
        ]);

        if (ctxRes.ok) {
          const c = await ctxRes.json();
          if (!c.hasEnrollment || c.reason === "already_submitted") {
            router.replace("/app/program");
            return;
          }
          setContext(c);
        } else {
          router.replace("/app/program");
          return;
        }

        if (statsRes.ok) {
          const s = await statsRes.json();
          setStats(s);
        }

        if (progRes.ok) {
          const p = await progRes.json();
          const slug = p.program?.slug ?? null;
          setProgramSlug(slug);
          setTotalDays(p.total_days ?? 21);

          // Fetch review_content
          if (p.enrollment?.id && p.program?.id) {
            const weekNum = Math.floor((p.enrollment.current_day ?? 0) / 7);
            if (weekNum >= 1) {
              const rcRes = await fetch(
                `/api/reviews/weekly/content?program_id=${p.program.id}&week_number=${weekNum}`
              );
              if (rcRes.ok) {
                const rc = await rcRes.json();
                setReviewContent(rc.content ?? null);
              }
            }
          }
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const goToSection = useCallback((n: number) => {
    setActiveSection(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const saveBodyCheck = useCallback(async () => {
    if (!context) return;
    await fetch("/api/reviews/body-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enrollment_id: context.enrollment_id,
        week_number: context.week_number,
        ...bodyScores,
        notes: bodyNotes.trim() || null,
      }),
    });
  }, [context, bodyScores, bodyNotes]);

  const handleComplete = useCallback(async () => {
    if (!context || submitting) return;
    setSubmitting(true);

    try {
      // 1. Save body check
      await saveBodyCheck();

      // 2. Save weekly review
      const difficultyFromEnergy =
        energyLevel <= 2 ? 4 : energyLevel === 3 ? 3 : 2;

      await fetch("/api/reviews/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollment_id: context.enrollment_id,
          week_number: context.week_number,
          fatigue_level: energyLevel || 3,
          progress_feeling: progressTags.length > 0 ? Math.min(5, progressTags.length + 1) : 2,
          difficulty_rating: difficultyFromEnergy,
          body_changes: progressTags.join(", ") || null,
          biggest_challenge: challenge || null,
          next_week_goal: selfNote.trim() || null,
        }),
      });

      // 3. Check-in with mode='review'
      const reviewDay = context.week_number * 7;
      await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollment_id: context.enrollment_id,
          day_number: reviewDay,
          mode: "review",
          feeling: energyLevel || 3,
        }),
      });

      // 4. Celebration
      setShowCelebration(true);
      setTimeout(() => {
        router.push("/app/program");
      }, 3000);
    } catch {
      setSubmitting(false);
    }
  }, [context, submitting, energyLevel, progressTags, challenge, selfNote, saveBodyCheck, router]);

  // ── Loading / guards ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <p className="text-neutral-500">Đang tải Review Chủ nhật...</p>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-neutral-600">Không thể tải dữ liệu review.</p>
        <Link href="/app/program" className="text-sm font-medium text-primary hover:underline">
          ← Quay lại chương trình
        </Link>
      </div>
    );
  }

  const ws = context.week_stats;
  const weekNum = context.week_number;

  // Personalized message for Part 4
  const getPersonalMessage = () => {
    if (!ws) return "Bạn đã hoàn thành một tuần nữa!";
    if (ws.completed_count >= 6) return "Tuần hoàn hảo! Bạn thuộc nhóm kiên trì nhất đợt tập.";
    if (ws.completed_count === 5) return "Gần hoàn hảo! Quan trọng là bạn vẫn ở đây.";
    if (ws.hard_count >= 3) return `Ngưỡng mộ! Bạn tập Hard ${ws.hard_count}/5 ngày tuần này.`;
    if (ws.completed_count <= 3)
      return "Mỗi buổi tập đều có giá trị. Tuần tới, thử tập đều hơn nhé!";
    return "Bạn đang tiến bộ! Tiếp tục giữ nhịp nhé.";
  };

  // ── Celebration overlay ──────────────────────────────────────────────────

  if (showCelebration) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <ConfettiParticles />
        <div className="relative mx-4 max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
          <div className="mb-4 text-6xl">🌟</div>
          <h2 className="font-heading text-2xl font-bold text-primary">
            Review Tuần {weekNum} hoàn thành!
          </h2>
          <p className="mt-2 text-neutral-600">{getPersonalMessage()}</p>
          {stats && stats.streak.current_streak > 0 && (
            <p className="mt-4 text-sm font-medium text-primary">
              Streak: 🔥 {stats.streak.current_streak} ngày
            </p>
          )}
          <p className="mt-4 text-sm text-neutral-400">Đang chuyển hướng...</p>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-24">
      <Link
        href="/app/program"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        ← Quay lại chương trình
      </Link>

      {/* Page header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
          Review Chủ nhật – Tuần {weekNum}
        </h1>
        <p className="mt-2 text-neutral-600">
          ~25 phút dành cho bản thân. Xem lại tuần qua, lắng nghe cơ thể, và chuẩn bị cho tuần mới.
        </p>
        {/* Progress dots */}
        <div className="mt-4 flex items-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full transition-all ${
                s <= activeSection ? "bg-primary" : "bg-neutral-200"
              }`}
            />
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1 — Video Review tuần */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section
        className={`rounded-2xl border-2 transition-all ${
          activeSection >= 1
            ? "border-primary/20 bg-white shadow-md"
            : "border-neutral-200 bg-neutral-50 opacity-60"
        } p-6`}
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
            1
          </span>
          <h2 className="font-heading text-lg font-semibold text-primary">
            Video Review tuần
          </h2>
          <span className="text-sm text-neutral-400">~10 phút</span>
        </div>

        {activeSection >= 1 && (
          <div className="space-y-4">
            {reviewContent?.review_video_url ? (
              <VimeoPlayer
                videoUrl={reviewContent.review_video_url}
                title={reviewContent.review_video_title ?? "Review video"}
              />
            ) : (
              <div className="rounded-xl bg-purple-50 p-8 text-center">
                <div className="text-5xl mb-3">🎬</div>
                <h3 className="font-heading text-lg font-semibold text-purple-800">
                  {reviewContent?.review_video_title ?? `Review Tuần ${weekNum}`}
                </h3>
                <p className="mt-2 text-sm text-purple-600">
                  Video review đang được chuẩn bị
                </p>
              </div>
            )}

            {/* Coach note & next week focus */}
            {(reviewContent?.coach_note || reviewContent?.next_week_focus) && (
              <div className="space-y-3">
                {reviewContent.coach_note && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm font-medium text-primary mb-1">Lời nhắn từ Coach</p>
                    <p className="text-neutral-700">{reviewContent.coach_note}</p>
                  </div>
                )}
                {reviewContent.next_week_focus && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-medium text-amber-800 mb-1">Focus tuần tới</p>
                    <p className="text-neutral-700">{reviewContent.next_week_focus}</p>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => goToSection(2)}
              className="w-full rounded-xl bg-primary px-4 py-3.5 font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Đã xem – Tiếp tục →
            </button>
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2 — Lắng nghe cơ thể */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section
        className={`rounded-2xl border-2 transition-all ${
          activeSection >= 2
            ? "border-primary/20 bg-white shadow-md"
            : "border-neutral-200 bg-neutral-50 opacity-60"
        } p-6`}
      >
        <div className="flex items-center gap-3 mb-4">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${
              activeSection >= 2 ? "bg-primary" : "bg-neutral-300"
            }`}
          >
            2
          </span>
          <h2 className="font-heading text-lg font-semibold text-primary">
            Lắng nghe cơ thể
          </h2>
          <span className="text-sm text-neutral-400">~5 phút</span>
        </div>

        {activeSection >= 2 && (
          <div className="space-y-6">
            {/* Guided breathing */}
            <div className="rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 p-6 text-center">
              <p className="text-4xl mb-3">🧘‍♀️</p>
              <h3 className="font-heading font-semibold text-primary">
                Trước tiên, hít thở sâu
              </h3>
              <div className="mt-4 space-y-2 text-neutral-600">
                <p>Ngồi thoải mái, nhắm mắt.</p>
                <p className="font-medium text-primary">
                  Hít vào 4 giây... Giữ 4 giây... Thở ra 4 giây...
                </p>
                <p>Làm 3 lần rồi mở mắt.</p>
              </div>
            </div>

            {/* Body map */}
            <div>
              <h3 className="font-heading font-semibold text-primary mb-1">
                Body Scan – Cơ thể bạn hôm nay
              </h3>
              <p className="text-sm text-neutral-500 mb-4">
                Chạm vào từng vùng và chọn cảm giác
              </p>

              <div className="space-y-3">
                {BODY_AREAS.map((area) => (
                  <div
                    key={area.key}
                    className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50/50 p-3"
                  >
                    <span className="w-20 text-sm font-medium text-neutral-700 shrink-0">
                      {area.label}
                    </span>
                    <div className="flex gap-2 flex-1">
                      {BODY_STATUS_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setBodyScores((s) => ({ ...s, [area.key]: opt.value }))
                          }
                          className={`flex-1 rounded-lg px-2 py-2 text-center text-xs font-medium transition-all ${
                            bodyScores[area.key] === opt.value
                              ? opt.value === 1
                                ? "bg-green-100 text-green-800 ring-2 ring-green-300"
                                : opt.value === 2
                                ? "bg-amber-100 text-amber-800 ring-2 ring-amber-300"
                                : "bg-red-100 text-red-800 ring-2 ring-red-300"
                              : "bg-white text-neutral-600 hover:bg-neutral-100"
                          }`}
                        >
                          <span className="text-base">{opt.emoji}</span>
                          <br />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <textarea
                value={bodyNotes}
                onChange={(e) => setBodyNotes(e.target.value)}
                placeholder="Ghi chú thêm về cơ thể (tùy chọn)..."
                rows={2}
                className="mt-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                saveBodyCheck();
                goToSection(3);
              }}
              className="w-full rounded-xl bg-primary px-4 py-3.5 font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Tiếp tục →
            </button>
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 3 — Tự đánh giá tuần */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section
        className={`rounded-2xl border-2 transition-all ${
          activeSection >= 3
            ? "border-primary/20 bg-white shadow-md"
            : "border-neutral-200 bg-neutral-50 opacity-60"
        } p-6`}
      >
        <div className="flex items-center gap-3 mb-4">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${
              activeSection >= 3 ? "bg-primary" : "bg-neutral-300"
            }`}
          >
            3
          </span>
          <h2 className="font-heading text-lg font-semibold text-primary">
            Tự đánh giá tuần
          </h2>
        </div>

        {activeSection >= 3 && (
          <div className="space-y-6">
            {/* Auto stats */}
            {ws && (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-3 text-center">
                  <p className="text-2xl font-bold text-primary">
                    {ws.completed_count}/6
                  </p>
                  <p className="text-xs text-neutral-500">ngày hoàn thành</p>
                </div>
                <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-3 text-center">
                  <p className="text-2xl font-bold text-primary">
                    {ws.hard_count}
                  </p>
                  <p className="text-xs text-neutral-500">buổi Hard</p>
                </div>
                <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-3 text-center">
                  <p className="text-2xl font-bold text-primary">
                    {ws.avg_feeling != null
                      ? ws.avg_feeling.toFixed(1)
                      : "–"}
                  </p>
                  <p className="text-xs text-neutral-500">cảm giác TB</p>
                </div>
              </div>
            )}

            {/* Q1: Energy level */}
            <div>
              <p className="font-medium text-neutral-800 mb-3">
                Năng lượng tuần này?
              </p>
              <div className="flex gap-2">
                {ENERGY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEnergyLevel(opt.value)}
                    className={`flex-1 rounded-xl py-3 text-center transition-all ${
                      energyLevel === opt.value
                        ? "bg-primary text-white shadow-md ring-2 ring-primary/30"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    <span className="text-2xl block">{opt.emoji}</span>
                    <span className="text-[10px] block mt-1">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Q2: Progress */}
            <div>
              <p className="font-medium text-neutral-800 mb-3">
                Bạn thấy tiến bộ ở đâu?
              </p>
              <div className="flex flex-wrap gap-2">
                {PROGRESS_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() =>
                      setProgressTags((tags) =>
                        tags.includes(chip)
                          ? tags.filter((t) => t !== chip)
                          : [...tags, chip]
                      )
                    }
                    className={`rounded-full px-3.5 py-2 text-sm font-medium transition-all ${
                      progressTags.includes(chip)
                        ? "bg-primary text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Q3: Challenge */}
            <div>
              <p className="font-medium text-neutral-800 mb-3">
                Tuần tới bạn muốn thử thách gì?
              </p>
              <div className="grid grid-cols-2 gap-3">
                {CHALLENGE_CARDS.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setChallenge(card.id)}
                    className={`rounded-xl border-2 p-4 text-center transition-all ${
                      challenge === card.id
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-neutral-200 bg-white hover:border-neutral-300"
                    }`}
                  >
                    <span className="text-2xl block">{card.emoji}</span>
                    <span className="text-sm font-medium mt-1 block">
                      {card.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Q4: Note */}
            <div>
              <p className="font-medium text-neutral-800 mb-2">
                Ghi chú cho bản thân
              </p>
              <textarea
                value={selfNote}
                onChange={(e) => setSelfNote(e.target.value)}
                placeholder="Điều bạn muốn nhớ tuần tới... (tùy chọn)"
                rows={3}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>

            <button
              type="button"
              onClick={() => goToSection(4)}
              disabled={energyLevel === 0}
              className="w-full rounded-xl bg-primary px-4 py-3.5 font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              Tiếp tục →
            </button>
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 4 — Sẵn sàng cho tuần mới */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section
        className={`rounded-2xl border-2 transition-all ${
          activeSection >= 4
            ? "border-primary/20 bg-white shadow-md"
            : "border-neutral-200 bg-neutral-50 opacity-60"
        } p-6`}
      >
        <div className="flex items-center gap-3 mb-4">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${
              activeSection >= 4 ? "bg-primary" : "bg-neutral-300"
            }`}
          >
            4
          </span>
          <h2 className="font-heading text-lg font-semibold text-primary">
            Sẵn sàng cho tuần mới!
          </h2>
        </div>

        {activeSection >= 4 && (
          <div className="space-y-6">
            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
                <p className="text-3xl font-bold text-primary">
                  🔥 {stats?.streak.current_streak ?? 0}
                </p>
                <p className="text-sm text-neutral-600 mt-1">streak hiện tại</p>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
                <p className="text-3xl font-bold text-primary">
                  {stats?.streak.total_completed_days ?? 0}/{totalDays}
                </p>
                <p className="text-sm text-neutral-600 mt-1">ngày đã hoàn thành</p>
              </div>
            </div>

            {/* Personal message */}
            <div className="rounded-xl bg-gradient-to-br from-primary/5 to-purple-50 p-6 text-center">
              <p className="text-4xl mb-3">✨</p>
              <p className="font-heading text-lg font-semibold text-primary">
                {getPersonalMessage()}
              </p>
            </div>

            {/* Next week focus from review_content */}
            {reviewContent?.next_week_focus && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-800 mb-1">
                  Focus tuần tới
                </p>
                <p className="text-neutral-700">
                  {reviewContent.next_week_focus}
                </p>
              </div>
            )}

            {/* Complete button */}
            <button
              type="button"
              onClick={handleComplete}
              disabled={submitting}
              className="w-full rounded-xl bg-primary px-4 py-4 text-base font-bold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {submitting
                ? "Đang lưu..."
                : "Tôi sẵn sàng cho tuần mới! 💪"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
