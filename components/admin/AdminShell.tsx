"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/orders", label: "Đơn hàng", icon: "🛒" },
  { href: "/admin/cohorts", label: "Cohorts", icon: "👥" },
  { href: "/admin/analytics/revenue", label: "Revenue", icon: "💰" },
  { href: "/admin/analytics/funnel", label: "Funnel", icon: "🔄" },
  { href: "/admin/analytics/dropout", label: "Dropout", icon: "📉" },
  { href: "/admin/nudging", label: "Nudging", icon: "🔔" },
  { href: "/admin/zalo", label: "Zalo", icon: "💬" },
  { href: "/admin/referral", label: "Referral", icon: "🎁" },
  { href: "/admin/affiliate", label: "Affiliate", icon: "🤝" },
  { href: "/admin/users", label: "Users", icon: "👤" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
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
        className={`fixed lg:static inset-y-0 left-0 z-50 w-56 shrink-0 flex flex-col border-r border-neutral-200 bg-white transform transition-transform duration-200 lg:transform-none ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        aria-label="Admin navigation"
      >
        <div className="sticky top-0 flex h-screen flex-col py-6">
          <div className="flex items-center justify-between px-4">
            <Link
              href="/admin"
              className="font-heading text-lg font-bold text-primary"
              onClick={() => setSidebarOpen(false)}
            >
              Admin
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-neutral-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Đóng menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="mt-6 flex-1 space-y-0.5 px-3">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-100 hover:text-primary min-h-[44px] transition-colors"
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center border-b border-neutral-200 bg-white px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-neutral-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Mở menu"
          >
            <Menu className="h-6 w-6 text-primary" />
          </button>
        </header>
        <main
          id="main-content"
          className="flex-1 overflow-auto bg-neutral-50 p-4 sm:p-6"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
