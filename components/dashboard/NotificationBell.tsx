"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Notification {
  id: string;
  type: string;
  title: string | null;
  content: string | null;
  is_read: boolean;
  created_at: string;
  metadata: Record<string, unknown>;
}

const TYPE_ICON: Record<string, string> = {
  trial_expired: "⏰",
  trial_reminder_24h: "⏰",
  trial_reminder_6h: "⏰",
  payment_confirmed: "✅",
  cohort_starting: "🚀",
  enrollment_activated: "🎉",
  rescue_soft: "🆘",
  rescue_urgent: "🆘",
  rescue_critical: "🆘",
  community_post: "👥",
};

const TYPE_ACTION: Record<string, string> = {
  trial_expired: "/app/programs",
  trial_reminder_24h: "/app/trial",
  trial_reminder_6h: "/app/trial",
  payment_confirmed: "/app/program",
  cohort_starting: "/app/program",
  enrollment_activated: "/app/program",
  rescue_soft: "/app/program",
  rescue_urgent: "/app/program",
  rescue_critical: "/app/program",
  community_post: "/app/community?tab=feed",
};

function getIcon(type: string): string {
  return TYPE_ICON[type] ?? "📌";
}

function getActionUrl(notif: Notification): string | null {
  const meta = notif.metadata as { action_url?: string };
  if (meta?.action_url) return meta.action_url;
  return TYPE_ACTION[notif.type] ?? null;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Vừa xong";
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays === 1) return "Hôm qua";
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return date.toLocaleDateString("vi-VN");
}

const PAGE_SIZE = 10;

export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);

  const loadNotifications = useCallback(
    async (reset = false) => {
      const supabase = createClient();
      const offset = reset ? 0 : offsetRef.current;

      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const { data, error } = await supabase
        .from("notifications")
        .select("id, type, title, content, is_read, created_at, metadata")
        .eq("user_id", userId)
        .eq("channel", "in_app")
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        if (reset) setLoading(false);
        else setLoadingMore(false);
        return;
      }

      const list = (data ?? []) as Notification[];

      if (reset) {
        setNotifications(list);
        offsetRef.current = list.length;
      } else {
        setNotifications((prev) => [...prev, ...list]);
        offsetRef.current += list.length;
      }

      setHasMore(list.length === PAGE_SIZE);
      if (reset) setLoading(false);
      else setLoadingMore(false);

      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("channel", "in_app")
        .eq("is_read", false);

      setUnreadCount(count ?? 0);
    },
    [userId]
  );

  useEffect(() => {
    if (!userId) return;
    loadNotifications(true);
  }, [userId, loadNotifications]);

  // Supabase Realtime: enable for table "notifications" in Dashboard > Database > Replication
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadNotifications(true);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadNotifications(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => document.removeEventListener("click", handleClickOutside);
  }, [open]);

  const handleMarkRead = async (id: string, actionUrl: string | null) => {
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    setOpen(false);

    if (actionUrl) {
      router.push(actionUrl);
    }
  };

  const handleMarkAllRead = async () => {
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("is_read", false);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) loadNotifications(false);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="relative rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 hover:text-primary"
        aria-label={`Thông báo${unreadCount > 0 ? ` (${unreadCount} chưa đọc)` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[360px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl sm:w-[400px]">
          <div className="border-b border-neutral-200 px-4 py-3">
            <h3 className="font-heading font-semibold text-primary">
              Thông báo
            </h3>
          </div>

          <div
            ref={listRef}
            className="max-h-[400px] overflow-y-auto"
            onScroll={(e) => {
              const el = e.target as HTMLDivElement;
              if (
                el.scrollHeight - el.scrollTop - el.clientHeight < 50 &&
                hasMore &&
                !loadingMore
              ) {
                handleLoadMore();
              }
            }}
          >
            {loading ? (
              <div className="flex items-center justify-center py-12 text-neutral-500">
                Đang tải...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center text-sm text-neutral-500">
                Không có thông báo mới
              </div>
            ) : (
              <>
                {notifications.map((notif) => {
                  const actionUrl = getActionUrl(notif);
                  return (
                    <button
                      key={notif.id}
                      type="button"
                      onClick={() => handleMarkRead(notif.id, actionUrl)}
                      className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50 ${
                        !notif.is_read ? "bg-primary/5" : ""
                      }`}
                    >
                      <span className="text-xl">{getIcon(notif.type)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-neutral-800 line-clamp-1">
                          {notif.title || "Thông báo"}
                        </p>
                        {notif.content && (
                          <p className="mt-0.5 line-clamp-2 text-sm text-neutral-600">
                            {notif.content}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-neutral-400">
                          {formatRelativeTime(notif.created_at)}
                        </p>
                      </div>
                    </button>
                  );
                })}
                {hasMore && (
                  <div className="border-t border-neutral-100 p-3">
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="w-full rounded-lg border border-neutral-200 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
                    >
                      {loadingMore ? "Đang tải..." : "Xem thêm"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {notifications.length > 0 && unreadCount > 0 && (
            <div className="border-t border-neutral-200 p-3">
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="w-full rounded-lg bg-neutral-100 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200"
              >
                Đánh dấu tất cả đã đọc
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
