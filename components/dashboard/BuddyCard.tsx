"use client";

import { useEffect, useState, useCallback } from "react";

interface BuddyInfo {
  id: string;
  name: string | null;
  has_zalo: boolean;
  checked_in_today: boolean;
  current_streak: number;
}

interface SearchResult {
  id: string;
  name: string | null;
}

interface BuddyStatus {
  has_buddy: boolean;
  enrollment_status: string | null;
  buddy?: BuddyInfo;
  cohort_id?: string;
  enrollment_id?: string;
  matched_by?: string;
  paired_at?: string;
}

export function BuddyCard() {
  const [status, setStatus] = useState<BuddyStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [nudging, setNudging] = useState(false);
  const [nudged, setNudged] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/buddy/status");
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Search debounce
  useEffect(() => {
    if (!status || status.has_buddy || status.enrollment_status !== "active") return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const url = query.trim().length >= 2
          ? `/api/buddy/search?q=${encodeURIComponent(query.trim())}`
          : "/api/buddy/search";
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
        }
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, status]);

  const handleChoose = async (buddyUserId: string) => {
    setChoosing(buddyUserId);
    try {
      const res = await fetch("/api/buddy/choose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buddy_user_id: buddyUserId }),
      });
      if (res.ok) {
        await loadStatus();
      }
    } finally {
      setChoosing(null);
    }
  };

  const handleRandomMatch = async () => {
    if (!results.length) return;
    const random = results[Math.floor(Math.random() * results.length)];
    await handleChoose(random.id);
  };

  const handleNudge = async () => {
    setNudging(true);
    try {
      const res = await fetch("/api/buddy/nudge", { method: "POST" });
      if (res.ok) {
        setNudged(true);
        setTimeout(() => setNudged(false), 5000);
      }
    } finally {
      setNudging(false);
    }
  };

  if (loading || !status) return null;

  // Không có enrollment nào → ẩn hoàn toàn
  if (!status.enrollment_status) return null;

  // ── Trial → preview text ──────────────────────────────────────────────────
  if (status.enrollment_status === "trial") {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h3 className="font-heading text-sm font-semibold text-primary">
          Buddy
        </h3>
        <p className="mt-2 text-sm text-neutral-500">
          Khi tham gia chương trình chính thức, bạn sẽ được ghép đôi với một
          người đồng hành cùng đợt tập.
        </p>
      </div>
    );
  }

  // Không có cohort (active nhưng chưa vào cohort) → ẩn
  if (!status.cohort_id) return null;

  // ── Có buddy ──────────────────────────────────────────────────────────────
  if (status.has_buddy && status.buddy) {
    const { buddy } = status;
    const buddyName = buddy.name?.split(" ").pop() || buddy.name || "Buddy";

    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h3 className="font-heading text-sm font-semibold text-primary">
          👯 Buddy
        </h3>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <p className="font-medium text-neutral-800">{buddy.name}</p>
            <div className="mt-1 flex items-center gap-3 text-sm">
              {buddy.checked_in_today ? (
                <span className="text-success font-medium">Đã tập ✅</span>
              ) : (
                <span className="text-neutral-500">Chưa tập</span>
              )}
              {buddy.current_streak > 0 && (
                <span className="text-neutral-500">
                  🔥 {buddy.current_streak} ngày
                </span>
              )}
            </div>
          </div>
          {!buddy.checked_in_today && buddy.has_zalo && (
            <button
              type="button"
              onClick={handleNudge}
              disabled={nudging || nudged}
              className="shrink-0 rounded-lg border border-primary/30 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
            >
              {nudged ? "Đã nhắc!" : nudging ? "..." : `Nhắc ${buddyName}`}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Chưa có buddy → search + ghép ngẫu nhiên ─────────────────────────────
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <h3 className="font-heading text-sm font-semibold text-primary">
        👯 Tìm người đồng hành
      </h3>
      <p className="mt-1 text-xs text-neutral-500">
        Buddy giúp bạn duy trì động lực. Chọn 1 người cùng đợt tập!
      </p>

      <div className="mt-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo tên..."
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400"
        />
      </div>

      {searching && (
        <p className="mt-2 text-xs text-neutral-400">Đang tìm...</p>
      )}

      {!searching && results.length > 0 && (
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
          {results.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-neutral-50">
              <span className="text-sm text-neutral-700">{r.name}</span>
              <button
                type="button"
                onClick={() => handleChoose(r.id)}
                disabled={choosing === r.id}
                className="shrink-0 rounded-md bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {choosing === r.id ? "..." : "Chọn"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!searching && results.length === 0 && !loading && (
        <p className="mt-2 text-xs text-neutral-400">Không tìm thấy ai phù hợp.</p>
      )}

      {results.length > 0 && (
        <button
          type="button"
          onClick={handleRandomMatch}
          disabled={!!choosing}
          className="mt-3 w-full rounded-lg border-2 border-dashed border-primary/30 py-2.5 text-sm font-medium text-primary transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
        >
          Ghép ngẫu nhiên
        </button>
      )}
    </div>
  );
}
