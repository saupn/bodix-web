"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Menu, X, LogOut, Home, Dumbbell, BarChart3, User, Users, FileText, Gift, Handshake } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "./NotificationBell";
import { StreakBadge } from "@/components/completion/StreakBadge";
import { RescueBanner } from "@/components/rescue/RescueBanner";

const NAV_LINKS_BASE = [
  { href: "/app", label: "Trang chủ", icon: Home },
  { href: "/app/programs", label: "Chương trình", icon: Dumbbell },
  { href: "/app/review/history", label: "📝 Review", icon: FileText },
  { href: "/app/referral", label: "🎁 Giới thiệu bạn bè", icon: Gift },
  { href: "/app/community", label: "👥 Cộng đồng", icon: Users, badgeKey: "community" },
  { href: "/app/progress", label: "📊 Tiến độ", icon: BarChart3 },
  { href: "/app/profile", label: "Hồ sơ", icon: User },
];

const PROGRAM_NAV = { href: "/app/program", label: "Chương trình của tôi", icon: Dumbbell };

interface DashboardShellProps {
  children: React.ReactNode;
  giftSection?: {
    remaining: number;
    total: number;
    referralCode: string;
    baseUrl: string;
  } | null;
  unpaidBanner?: React.ReactNode;
  profile: {
    full_name: string | null;
    avatar_url: string | null;
    trial_ends_at: string | null;
  };
  userEmail: string;
  userId: string;
  hasActiveProgram?: boolean;
  streak?: { current: number; longest: number } | null;
  rescue?: {
    riskLevel: string;
    suggestedMode: string;
    programDay: number;
    completedDays: number;
    lightDuration: number;
    recoveryDuration: number;
    interventionId: string;
  } | null;
  isAffiliate?: boolean;
}

function getTrialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  const end = new Date(trialEndsAt);
  const now = new Date();
  if (end <= now) return 0;
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getInitials(name: string | null, email: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  }
  return email?.[0]?.toUpperCase() ?? "?";
}

export function DashboardShell({ children, giftSection, unpaidBanner, profile, userEmail, userId, hasActiveProgram, streak, rescue, isAffiliate }: DashboardShellProps) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [communityBadge, setCommunityBadge] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const res = await fetch("/api/notifications/community-unread");
      if (res.ok) {
        const data = await res.json();
        setCommunityBadge(data.count ?? 0);
      }
    };
    load();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel("community-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { type?: string };
          if (row.type === "community_post") {
            fetch("/api/notifications/community-unread")
              .then((r) => r.ok && r.json())
              .then((d) => d && setCommunityBadge(d.count ?? 0));
          }
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
          fetch("/api/notifications/community-unread")
            .then((r) => r.ok && r.json())
            .then((d) => d && setCommunityBadge(d.count ?? 0));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const displayName = profile.full_name?.trim() || userEmail || "bạn";
  const trialDays = getTrialDaysLeft(profile.trial_ends_at);
  const isInTrial = trialDays !== null && trialDays > 0;

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const NavLink = ({ href, label, icon: Icon, badgeKey }: (typeof NAV_LINKS_BASE)[0]) => (
    <Link
      href={href}
      onClick={() => setSidebarOpen(false)}
      className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-neutral-600 hover:text-primary hover:bg-secondary transition-colors min-h-[44px]"
    >
      <Icon className="h-5 w-5 shrink-0" />
      {label}
      {badgeKey === "community" && communityBadge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {communityBadge > 99 ? "99+" : communityBadge}
        </span>
      )}
    </Link>
  );

  return (
    <div className="min-h-screen flex bg-neutral-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col bg-white border-r border-neutral-200 transform transition-transform duration-200 lg:transform-none ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full p-4 sm:p-6">
          <div className="flex items-center justify-between mb-8">
            <Link href="/app" className="shrink-0">
              <Image
                src="/images/logo.png"
                alt="BodiX"
                width={90}
                height={30}
                className="h-8 w-auto object-contain"
              />
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-neutral-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Đóng menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex flex-col gap-1 flex-1">
            {hasActiveProgram && (
              <NavLink key={PROGRAM_NAV.href} {...PROGRAM_NAV} />
            )}
            {NAV_LINKS_BASE.map((link) => (
              <NavLink key={link.href} {...link} />
            ))}
            {isAffiliate && (
              <NavLink href="/app/affiliate" label="Đối tác" icon={Handshake} />
            )}
          </nav>

          <div className="border-t border-neutral-200 pt-4">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-neutral-600 hover:text-red-600 hover:bg-red-50 transition-colors min-h-[44px]"
              aria-label="Đăng xuất"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              Đăng xuất
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-neutral-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-neutral-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Mở menu"
          >
            <Menu className="h-6 w-6 text-primary" />
          </button>

          <p className="font-heading text-lg font-semibold text-primary truncate">
            Xin chào, {displayName}!
          </p>

          <div className="flex items-center gap-2 sm:gap-3">
            {streak && (
              <StreakBadge
                currentStreak={streak.current}
                longestStreak={streak.longest}
                compact
              />
            )}
            <NotificationBell userId={userId} />
            {isInTrial && (
              <span className="hidden sm:inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                Dùng thử: còn {trialDays} ngày
              </span>
            )}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={displayName}
                  width={36}
                  height={36}
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(profile.full_name, userEmail)
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main id="main-content" className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto" tabIndex={-1}>
          {giftSection && (
            <div className="mb-6 rounded-xl border-2 border-[#2D4A3E]/20 bg-[#2D4A3E]/5 p-4 sm:p-5">
              <h3 className="font-heading font-semibold text-[#2D4A3E]">
                Tặng sách cho bạn bè
              </h3>
              <p className="mt-1 text-sm text-neutral-600">
                Còn lại: {giftSection.remaining}/{giftSection.total} suất
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${giftSection.baseUrl}/tang-sach?from=${giftSection.referralCode}`}
                  className="flex-1 min-w-0 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${giftSection!.baseUrl}/tang-sach?from=${giftSection!.referralCode}`);
                  }}
                  className="rounded-lg border border-[#2D4A3E]/30 px-3 py-2 text-sm font-medium text-[#2D4A3E] hover:bg-[#2D4A3E]/5"
                >
                  Copy
                </button>
                <a
                  href={`https://zalo.me/share?text=${encodeURIComponent(`Mình tặng bạn Cẩm nang BodiX Fuel Guide miễn phí! ${giftSection!.baseUrl}/tang-sach?from=${giftSection!.referralCode}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-[#0068FF] px-3 py-2 text-sm font-medium text-white hover:bg-[#0052cc]"
                >
                  Chia sẻ Zalo
                </a>
              </div>
            </div>
          )}
          {unpaidBanner}
          {rescue && (
            <div className="mb-6">
              <RescueBanner
                riskLevel={rescue.riskLevel as "low" | "medium" | "high" | "critical"}
                suggestedMode={rescue.suggestedMode as "hard" | "light" | "recovery"}
                programDay={rescue.programDay}
                completedDays={rescue.completedDays}
                lightDuration={rescue.lightDuration}
                recoveryDuration={rescue.recoveryDuration}
                interventionId={rescue.interventionId}
                onPauseSuccess={() => window.location.href = "/app"}
              />
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
