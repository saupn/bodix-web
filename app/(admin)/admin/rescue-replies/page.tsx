"use client";

import { useCallback, useEffect, useState } from "react";

interface RescueReply {
  id: string;
  message_text: string;
  received_at: string;
  status: "needs_founder_reply" | "resolved";
  resolved_at: string | null;
  profiles: {
    full_name: string | null;
    phone: string | null;
    channel_user_id: string | null;
  } | null;
}

const TABS = [
  { value: "needs_founder_reply", label: "Cần trả lời" },
  { value: "resolved", label: "Đã trả lời" },
  { value: "all", label: "Tất cả" },
] as const;

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminRescueRepliesPage() {
  const [tab, setTab] = useState<string>("needs_founder_reply");
  const [replies, setReplies] = useState<RescueReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchReplies = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/rescue-replies?status=${tab}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setReplies(d.replies || []);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    fetchReplies();
  }, [fetchReplies]);

  const setStatus = async (id: string, status: RescueReply["status"]) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/rescue-replies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok || data.error) setError(data.error || "Cập nhật thất bại.");
      else fetchReplies();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tin tâm sự cần trả lời</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Tin user nhắn lại trong 48h sau tin rescue. Bot đã trả lời ấm áp tự động –
          bạn trả lời tay trong Zalo OA Manager, rồi đánh dấu đã trả lời ở đây.
        </p>
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.value
                ? "bg-primary text-white"
                : "bg-white text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-neutral-500">Đang tải...</p>
      ) : replies.length === 0 ? (
        <p className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
          Không có tin nào.
        </p>
      ) : (
        <div className="space-y-3">
          {replies.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border border-neutral-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">
                  {r.profiles?.full_name || "Không rõ tên"}
                  {r.profiles?.phone && (
                    <span className="ml-2 text-sm font-normal text-neutral-500">
                      {r.profiles.phone}
                    </span>
                  )}
                </span>
                <span className="text-xs text-neutral-400">
                  {fmtWhen(r.received_at)}
                </span>
              </div>

              <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-800">
                {r.message_text}
              </p>

              <div className="mt-3 flex items-center gap-3">
                {r.status === "needs_founder_reply" ? (
                  <button
                    onClick={() => setStatus(r.id, "resolved")}
                    disabled={busyId === r.id}
                    className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                  >
                    {busyId === r.id ? "Đang lưu..." : "Đã trả lời"}
                  </button>
                ) : (
                  <>
                    <span className="text-sm text-green-600">
                      Đã trả lời{r.resolved_at ? ` lúc ${fmtWhen(r.resolved_at)}` : ""}
                    </span>
                    <button
                      onClick={() => setStatus(r.id, "needs_founder_reply")}
                      disabled={busyId === r.id}
                      className="text-sm text-neutral-500 underline hover:text-neutral-700 disabled:opacity-50"
                    >
                      Mở lại
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
