"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Camera } from "lucide-react";

const MODE_EMOJI: Record<string, string> = {
  hard: "💪",
  light: "🌿",
  easy: "☀️",
  recovery: "🧘",
  review: "📝",
  skip: "⏭️",
};

const POST_TYPE_BADGE: Record<string, string> = {
  completion_share: "✅ Hoàn thành",
  milestone_share: "🏆 Thành tích",
  progress_photo: "📸 Tiến bộ",
  motivation: "💬 Động lực",
  question: "❓ Hỏi đáp",
  program_complete: "🎉 Hoàn thành chương trình",
};

const POST_TYPE_OPTIONS = [
  { id: "completion_share", label: "Chia sẻ hoàn thành" },
  { id: "milestone_share", label: "Chia sẻ thành tích" },
  { id: "progress_photo", label: "Ảnh tiến bộ" },
  { id: "motivation", label: "Động lực" },
  { id: "question", label: "Hỏi đáp" },
];

const REACTIONS = [
  { type: "heart" as const, emoji: "❤️" },
  { type: "clap" as const, emoji: "👏" },
  { type: "fire" as const, emoji: "🔥" },
  { type: "like" as const, emoji: "💪" },
];

interface Member {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  checked_in_today: boolean;
  mode_today: string | null;
  current_streak: number;
  completion_rate: number;
  is_highlighted: boolean;
}

interface BoardData {
  cohort_id: string;
  cohort_name: string;
  date: string;
  stats: { total_members: number; completed_today: number; avg_completion_rate: number };
  members: Member[];
  me_checked_in_today?: boolean;
}

interface ProgramActiveData {
  enrollment: { cohort_id: string | null; current_day: number };
  cohort: { name: string } | null;
  program_day: number;
  today_completed: boolean;
}

interface FeedPost {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  post_type: string;
  content: string | null;
  media_urls: string[];
  milestone_type: string | null;
  created_at: string;
  reaction_counts: { heart: number; clap: number; fire: number; like: number };
  my_reaction: string | null;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name[0]?.toUpperCase() ?? "?";
}

const MODE_ORDER = ["hard", "light", "recovery", "skip"];

function sortCompletedByMode(members: Member[]): Member[] {
  const completed = members.filter((m) => m.checked_in_today);
  const notCompleted = members.filter((m) => !m.checked_in_today);
  completed.sort((a, b) => {
    const aIdx = MODE_ORDER.indexOf(a.mode_today ?? "skip");
    const bIdx = MODE_ORDER.indexOf(b.mode_today ?? "skip");
    return aIdx - bIdx;
  });
  return [...completed, ...notCompleted];
}

function formatTimeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Vừa xong";
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays === 1) return "Hôm qua";
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return d.toLocaleDateString("vi-VN");
}

export default function CommunityPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<"board" | "feed">(
    tabParam === "feed" ? "feed" : "board"
  );

  useEffect(() => {
    if (tabParam === "feed") setTab("feed");
  }, [tabParam]);
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [programData, setProgramData] = useState<ProgramActiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newlyCompletedIds, setNewlyCompletedIds] = useState<Set<string>>(new Set());
  const currentUserIdRef = useRef<string | null>(null);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsPage, setPostsPage] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [createType, setCreateType] = useState("motivation");
  const [createContent, setCreateContent] = useState("");
  const [createMedia, setCreateMedia] = useState<{ path: string; preview: string }[]>([]);
  const [createMediaFiles, setCreateMediaFiles] = useState<File[]>([]);
  const [createShareWithCohort, setCreateShareWithCohort] = useState(true);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const fetchBoard = useCallback(async (cohortId: string) => {
    const res = await fetch(`/api/completion/cohort-board?cohort_id=${cohortId}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Không tải được bảng.");
    }
    return res.json();
  }, []);

  const fetchPosts = useCallback(async (cohortId: string, page: number, append: boolean) => {
    setPostsLoading(true);
    try {
      const res = await fetch(
        `/api/community/posts?cohort_id=${cohortId}&page=${page}`
      );
      if (!res.ok) throw new Error("Không tải được bài viết.");
      const data = await res.json();
      setPosts((prev) => (append ? [...prev, ...data.posts] : data.posts));
      setHasMorePosts(data.has_more ?? false);
      setPostsPage(page);
    } finally {
      setPostsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const progRes = await fetch("/api/program/active");
        if (!progRes.ok) {
          if (progRes.status === 404) {
            setError("Bạn chưa có chương trình đang hoạt động.");
            return;
          }
          throw new Error("Không tải được chương trình.");
        }
        const prog: ProgramActiveData = await progRes.json();
        if (!mounted) return;

        const cohortId = prog.enrollment?.cohort_id;
        if (!cohortId) {
          setError("Bạn chưa được gán cohort.");
          return;
        }

        setProgramData(prog);
        const board = await fetchBoard(cohortId);
        if (mounted) setBoardData(board);

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (mounted && user) currentUserIdRef.current = user.id;
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, [fetchBoard]);

  useEffect(() => {
    if (tab === "feed" && boardData?.cohort_id) {
      fetchPosts(boardData.cohort_id, 0, false);
    }
  }, [tab, boardData?.cohort_id, fetchPosts]);

  useEffect(() => {
    if (!boardData?.cohort_id) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`cohort:${boardData.cohort_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "daily_checkins",
          filter: `cohort_id=eq.${boardData.cohort_id}`,
        },
        (payload) => {
          const row = payload.new as { user_id: string; mode: string; workout_date?: string };
          const today = new Date().toISOString().slice(0, 10);
          if (row.workout_date !== today) return;

          setBoardData((prev) => {
            if (!prev) return prev;
            const wasAlreadyCheckedIn = prev.members.some(
              (m) => m.user_id === row.user_id && m.checked_in_today
            );
            if (wasAlreadyCheckedIn) return prev;

            const next = prev.members.map((m) =>
              m.user_id === row.user_id
                ? { ...m, checked_in_today: true, mode_today: row.mode }
                : m
            );
            setNewlyCompletedIds((s) => new Set(s).add(row.user_id));
            setTimeout(() => {
              setNewlyCompletedIds((s) => {
                const n = new Set(s);
                n.delete(row.user_id);
                return n;
              });
            }, 2500);

            return {
              ...prev,
              members: next,
              stats: { ...prev.stats, completed_today: prev.stats.completed_today + 1 },
              me_checked_in_today:
                prev.me_checked_in_today || row.user_id === currentUserIdRef.current,
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardData?.cohort_id]);

  useEffect(() => {
    if (tab !== "feed" || !boardData?.cohort_id) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`community-posts:${boardData.cohort_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_posts",
          filter: `cohort_id=eq.${boardData.cohort_id}`,
        },
        () => {
          fetchPosts(boardData.cohort_id, 0, false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tab, boardData?.cohort_id, fetchPosts]);

  const handleReaction = async (postId: string, reactionType: string) => {
    const res = await fetch("/api/community/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: postId, reaction_type: reactionType }),
    });
    if (!res.ok) return;
    const data = await res.json();

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const counts = { ...p.reaction_counts };
        if (p.my_reaction) counts[p.my_reaction as keyof typeof counts]--;
        if (data.reaction_type) counts[data.reaction_type as keyof typeof counts]++;
        return {
          ...p,
          reaction_counts: counts,
          my_reaction: data.reaction_type as string | null,
        };
      })
    );
  };

  const handleUploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !boardData?.cohort_id) return;
    const toAdd = Math.min(3 - createMedia.length, files.length);
    for (let i = 0; i < toAdd; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);
      formData.append("index", String(createMedia.length + i));
      const res = await fetch("/api/community/upload", { method: "POST", body: formData });
      if (!res.ok) continue;
      const data = await res.json();
      setCreateMedia((prev) => [
        ...prev,
        { path: data.path, preview: data.signed_url ?? URL.createObjectURL(file) },
      ]);
      setCreateMediaFiles((prev) => [...prev, file]);
    }
    e.target.value = "";
  };

  const handleCreatePost = async () => {
    if (!boardData?.cohort_id) return;
    setCreateSubmitting(true);
    try {
      const mediaPaths = createMedia.map((m) => m.path);
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohort_id: boardData.cohort_id,
          post_type: createType,
          content: createContent.trim() || undefined,
          media_urls: mediaPaths.length > 0 ? mediaPaths : undefined,
        }),
      });
      if (res.ok) {
        setModalOpen(false);
        setCreateContent("");
        setCreateMedia([]);
        setCreateMediaFiles([]);
        fetchPosts(boardData.cohort_id, 0, false);
      } else {
        const err = await res.json();
        alert(err.error ?? "Không thể đăng.");
      }
    } finally {
      setCreateSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-neutral-500">Đang tải...</p>
      </div>
    );
  }

  if (error || !boardData) {
    const noCohort = error === "Bạn chưa có chương trình đang hoạt động." || error === "Bạn chưa được gán cohort.";
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center">
        {noCohort ? (
          <>
            <p className="text-4xl mb-4">👥</p>
            <h2 className="font-heading text-xl font-bold text-primary">Cộng đồng BodiX</h2>
            <p className="mt-3 text-neutral-600">
              Tham gia chương trình để xem cộng đồng và tập cùng mọi người!
            </p>
            <Link
              href="/app/programs"
              className="mt-6 inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-secondary-light hover:bg-primary-dark"
            >
              Xem chương trình
            </Link>
          </>
        ) : (
          <>
            <p className="text-neutral-600">{error ?? "Không tải được dữ liệu."}</p>
            <Link href="/app" className="mt-4 inline-block text-primary hover:underline">
              Về trang chủ
            </Link>
          </>
        )}
      </div>
    );
  }

  const sortedMembers = sortCompletedByMode(boardData.members);
  const completed = sortedMembers.filter((m) => m.checked_in_today);
  const pending = sortedMembers.filter((m) => !m.checked_in_today);
  const { stats } = boardData;
  const progressPct = stats.total_members > 0 ? (stats.completed_today / stats.total_members) * 100 : 0;
  const programDay = programData?.program_day ?? 0;
  const todayCompleted = boardData.me_checked_in_today ?? false;

  return (
    <div className={`mx-auto max-w-2xl space-y-6 ${!todayCompleted && programDay > 0 ? "pb-28" : "pb-8"}`}>
      {/* Tabs */}
      <div className="flex gap-2 border-b border-neutral-200">
        <button
          type="button"
          onClick={() => setTab("board")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "board"
              ? "border-primary text-primary"
              : "border-transparent text-neutral-600 hover:text-primary"
          }`}
        >
          Bảng hoàn thành
        </button>
        <button
          type="button"
          onClick={() => setTab("feed")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "feed"
              ? "border-primary text-primary"
              : "border-transparent text-neutral-600 hover:text-primary"
          }`}
        >
          Bảng tin
        </button>
      </div>

      {tab === "board" ? (
        <>
          <div>
            <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
              Hôm nay ai đã tập?
            </h1>
            <p className="mt-1 text-sm text-neutral-500">{boardData.cohort_name}</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-neutral-600">
                  {stats.completed_today}/{stats.total_members} đã hoàn thành hôm nay
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
            <div className="space-y-6">
              <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                <h2 className="mb-4 font-heading text-base font-semibold text-primary">
                  ✅ Đã hoàn thành
                </h2>
                {completed.length === 0 ? (
                  <p className="py-6 text-center text-sm text-neutral-500">
                    Chưa ai check-in hôm nay. Hãy là người đầu tiên!
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {completed.map((m) => {
                      const isMe = m.user_id === currentUserIdRef.current;
                      return (
                        <li
                          key={m.user_id}
                          className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${
                            newlyCompletedIds.has(m.user_id) ? "animate-fade-slide-up" : ""
                          } ${
                            isMe
                              ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                              : m.is_highlighted
                              ? "border-amber-300 bg-amber-50/50"
                              : "border-neutral-200"
                          }`}
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-sm font-semibold text-primary">
                            {m.avatar_url ? (
                              <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              getInitials(m.display_name)
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-neutral-800">
                              {m.display_name}
                              {isMe && (
                                <span className="ml-1.5 text-xs text-primary font-normal">(Bạn)</span>
                              )}
                            </span>
                            {m.current_streak > 0 && (
                              <p className="text-xs text-neutral-500">
                                🔥{m.current_streak}
                              </p>
                            )}
                          </div>
                          {m.mode_today && (
                            <span className="shrink-0 text-xl" title={m.mode_today}>
                              {MODE_EMOJI[m.mode_today] ?? MODE_EMOJI.skip}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                <h2 className="mb-4 font-heading text-base font-semibold text-primary">
                  Đang chờ...
                </h2>
                {pending.length === 0 ? (
                  <p className="py-6 text-center text-sm text-neutral-500">
                    Tất cả đã hoàn thành hôm nay! 🎉
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {pending.map((m) => {
                      const isMe = m.user_id === currentUserIdRef.current;
                      return (
                        <li
                          key={m.user_id}
                          className={`flex items-center gap-3 rounded-lg border p-3 opacity-60 ${
                            isMe
                              ? "border-primary ring-2 ring-primary/30 opacity-100"
                              : "border-neutral-200"
                          }`}
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-sm font-medium text-neutral-400">
                            {m.avatar_url ? (
                              <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              getInitials(m.display_name)
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-neutral-500">
                              {m.display_name}
                              {isMe && (
                                <span className="ml-1.5 text-xs text-primary font-normal">(Bạn)</span>
                              )}
                            </span>
                            <p className="text-xs text-neutral-400">Đang chờ...</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

            <aside className="lg:w-64">
              <div className="sticky top-24 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                <h3 className="mb-3 font-heading text-sm font-semibold text-primary">
                  🔥 Streak Leaderboard
                </h3>
                {(() => {
                  const top10 = [...boardData.members]
                    .sort((a, b) => b.current_streak - a.current_streak)
                    .slice(0, 10)
                    .filter(m => m.current_streak > 0);

                  if (top10.length === 0) {
                    return (
                      <p className="py-4 text-center text-sm text-neutral-500">
                        Chưa có streak nào. Hãy bắt đầu!
                      </p>
                    );
                  }

                  return (
                    <ol className="space-y-2">
                      {top10.map((m, i) => {
                        const isMe = m.user_id === currentUserIdRef.current;
                        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
                        return (
                          <li
                            key={m.user_id}
                            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                              isMe ? "bg-primary/5 font-medium" : ""
                            }`}
                          >
                            <span className="w-6 shrink-0 text-center">{medal}</span>
                            <span className="min-w-0 flex-1 truncate text-neutral-700">
                              {m.display_name}
                              {isMe && <span className="text-xs text-primary ml-1">(Bạn)</span>}
                            </span>
                            <span className="shrink-0 font-mono text-xs text-neutral-500">
                              🔥{m.current_streak}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  );
                })()}
              </div>
            </aside>
          </div>

          {!todayCompleted && programDay > 0 && (
            <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-200 bg-white/95 p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur">
              <div className="mx-auto max-w-2xl">
                <Link
                  href={`/app/program/workout/${programDay}`}
                  className="block w-full rounded-xl bg-primary px-4 py-4 text-center text-base font-semibold text-secondary-light transition-colors hover:bg-primary-dark"
                >
                  Tập ngay →
                </Link>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Tab 2 — Feed */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="font-heading text-2xl font-bold text-primary">
              Bảng tin — {boardData.cohort_name}
            </h1>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
              Chia sẻ
            </button>
          </div>

          {postsLoading && posts.length === 0 ? (
            <p className="py-12 text-center text-neutral-500">Đang tải...</p>
          ) : posts.length === 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-12 text-center">
              <p className="text-neutral-600">
                Chưa có bài viết nào. Hãy là người đầu tiên chia sẻ! 🚀
              </p>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
              >
                Chia sẻ ngay
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-sm font-semibold text-primary">
                      {post.avatar_url ? (
                        <img src={post.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        getInitials(post.display_name)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-neutral-800">{post.display_name}</span>
                        <span className="text-xs text-neutral-500">
                          {formatTimeAgo(post.created_at)}
                        </span>
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
                          {POST_TYPE_BADGE[post.post_type] ?? post.post_type}
                        </span>
                      </div>
                      {post.content && (
                        <p className="mt-2 whitespace-pre-wrap text-neutral-700">{post.content}</p>
                      )}
                      {post.media_urls.length > 0 && (
                        <div className={`mt-3 grid gap-2 ${
                          post.media_urls.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"
                        }`}>
                          {post.media_urls.map((url, i) => (
                            <img
                              key={i}
                              src={url}
                              alt=""
                              className="aspect-square rounded-lg object-cover"
                            />
                          ))}
                        </div>
                      )}
                      <div className="mt-4 flex items-center gap-4">
                        {REACTIONS.map((r) => {
                          const count = post.reaction_counts[r.type] ?? 0;
                          const isActive = post.my_reaction === r.type;
                          return (
                            <button
                              key={r.type}
                              type="button"
                              onClick={() => handleReaction(post.id, r.type)}
                              className={`flex items-center gap-1 rounded-full px-2 py-1 text-sm transition-colors ${
                                isActive ? "bg-primary/15" : "hover:bg-neutral-100"
                              }`}
                            >
                              <span>{r.emoji}</span>
                              {count > 0 && (
                                <span className="text-xs text-neutral-500">{count}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              {hasMorePosts && (
                <button
                  type="button"
                  onClick={() => fetchPosts(boardData.cohort_id, postsPage + 1, true)}
                  disabled={postsLoading}
                  className="w-full rounded-lg border border-neutral-200 py-2 text-sm text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
                >
                  {postsLoading ? "Đang tải..." : "Xem thêm"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create post modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-heading text-lg font-semibold text-primary">
              Chia sẻ mới
            </h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium">Loại bài viết</label>
                <select
                  value={createType}
                  onChange={(e) => setCreateType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                >
                  {POST_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Nội dung</label>
                <textarea
                  value={createContent}
                  onChange={(e) => setCreateContent(e.target.value)}
                  placeholder="Viết gì đó..."
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Ảnh (tối đa 3)</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {createMedia.map((m, i) => (
                    <div key={i} className="relative">
                      <img
                        src={m.preview}
                        alt=""
                        className="h-20 w-20 rounded-lg object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCreateMedia((prev) => prev.filter((_, j) => j !== i));
                          setCreateMediaFiles((prev) => prev.filter((_, j) => j !== i));
                        }}
                        className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {createMedia.length < 3 && (
                    <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 hover:border-primary/50">
                      <Camera className="h-6 w-6 text-neutral-400" />
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleUploadMedia}
                      />
                    </label>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="share-cohort"
                  checked={createShareWithCohort}
                  onChange={(e) => setCreateShareWithCohort(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="share-cohort" className="text-sm">
                  Chia sẻ với đợt tập
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setCreateContent("");
                  setCreateMedia([]);
                }}
                className="rounded-lg border px-4 py-2 text-sm font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCreatePost}
                disabled={createSubmitting}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {createSubmitting ? "Đang đăng..." : "Đăng"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
