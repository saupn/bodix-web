"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const AdminChartsSection = dynamic(
  () => import("@/components/dashboard/AdminChartsSection"),
  {
    loading: () => (
      <div className="mt-8 h-96 animate-pulse rounded-xl border border-neutral-200 bg-white" />
    ),
    ssr: false,
  },
);

interface KpiData {
  actual: number;
  target: number | null;
  trend: "up" | "down" | "stable";
  delta_percent?: number | null;
  lower_is_better?: boolean;
}

interface OverviewData {
  kpis: {
    d7_adherence: KpiData;
    completion_21: KpiData;
    referral_share: KpiData;
    nps: KpiData;
    upgrade_21_to_6w: KpiData;
    churn_rate: KpiData & { lower_is_better?: boolean };
    visible_change_rate: KpiData;
    monthly_revenue: KpiData & { previous_month?: number };
  };
  today: {
    checkins: number;
    rescues: number;
    signups: number;
    purchases: number;
    revenue: number;
  };
  charts: {
    completion_daily: { date: string; rate_21: number; rate_6w: number; rate_12w: number }[];
    revenue_monthly: { month: string; bodix21: number; bodix6w: number; bodix12w: number; referral: number; total: number }[];
    funnel: { step: string; count: number; conversion: number | null }[];
    dropout: { day: number; count: number; rate: number; highlight: boolean }[];
  };
  alerts: { severity: "red" | "yellow" | "green"; message: string; link?: string }[];
  refreshed_at: string;
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

function kpiBgColor(k: KpiData, target: number | null): string {
  if (target == null) return "bg-neutral-50";
  const actual = k.actual;
  const lowerIsBetter = "lower_is_better" in k && k.lower_is_better;
  const meetsTarget = lowerIsBetter ? actual <= target : actual >= target;
  const gap = lowerIsBetter ? target - actual : actual - target;
  const pctOfTarget = target > 0 ? (gap / target) * 100 : 0;
  if (meetsTarget) return "bg-green-50";
  if (pctOfTarget < 15) return "bg-amber-50";
  return "bg-red-50";
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOverview = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/analytics/overview");
      if (r.ok) setData(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    const id = setInterval(fetchOverview, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchOverview]);

  const kpiCards: { key: keyof OverviewData["kpis"]; label: string; suffix?: string }[] = [
    { key: "d7_adherence", label: "D7 Adherence", suffix: "%" },
    { key: "completion_21", label: "Completion 21", suffix: "%" },
    { key: "referral_share", label: "Referral Share", suffix: "%" },
    { key: "nps", label: "NPS", suffix: "" },
    { key: "upgrade_21_to_6w", label: "Upgrade 21→6W", suffix: "%" },
    { key: "churn_rate", label: "Churn Rate", suffix: "%" },
    { key: "visible_change_rate", label: "Visible Change", suffix: "%" },
    { key: "monthly_revenue", label: "Revenue tháng", suffix: "đ" },
  ];

  if (loading && !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-neutral-500">Đang tải...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-red-500">Không thể tải dữ liệu.</p>
      </div>
    );
  }

  const { kpis, today, charts, alerts } = data;

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold text-primary">
            Admin Dashboard
          </h1>
          <p className="text-xs text-neutral-500">
            Cập nhật: {new Date(data.refreshed_at).toLocaleTimeString("vi-VN")}
          </p>
        </div>

        {/* Section 1: KPI Scoreboard */}
        <section className="mt-8">
          <h2 className="mb-4 text-sm font-semibold uppercase text-neutral-600">
            KPI Scoreboard
          </h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {kpiCards.map(({ key, label, suffix }) => {
              const k = kpis[key] as KpiData & { previous_month?: number };
              const target = k.target ?? (key === "monthly_revenue" ? null : 0);
              const displayVal = key === "monthly_revenue"
                ? (k.actual ?? 0).toLocaleString("vi-VN")
                : String(k.actual ?? 0);
              const invertProgress = "lower_is_better" in k && k.lower_is_better;
              const progress =
                target != null && target > 0
                  ? invertProgress
                    ? Math.min(100, (target / (k.actual || 1)) * 100)
                    : Math.min(100, ((k.actual ?? 0) / target) * 100)
                  : null;
              const progressVal = progress;

              return (
                <div
                  key={key}
                  className={`rounded-xl border p-4 ${kpiBgColor(k, target)}`}
                >
                  <p className="text-xs font-medium text-neutral-600">{label}</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-neutral-900">
                      {displayVal}{suffix}
                    </span>
                    {k.delta_percent != null && (
                      <span
                        className={`flex items-center text-sm ${
                          k.trend === "up"
                            ? "text-green-600"
                            : k.trend === "down"
                              ? "text-red-600"
                              : "text-neutral-500"
                        }`}
                      >
                        {k.trend === "up" && "↑"}
                        {k.trend === "down" && "↓"}
                        {k.delta_percent}%
                      </span>
                    )}
                  </div>
                  {target != null && (
                    <div className="mt-2">
                      <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-200">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, progressVal ?? 0)}%` }}
                        />
                      </div>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {k.actual ?? 0} / {target}{suffix === "%" ? "%" : ""}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 2: Today's Pulse */}
        <section className="mt-8">
          <h2 className="mb-4 text-sm font-semibold uppercase text-neutral-600">
            Today&apos;s Pulse
          </h2>
          <div className="flex flex-wrap gap-4">
            {[
              { label: "Check-ins", value: today.checkins },
              { label: "Rescues", value: today.rescues },
              { label: "Signups", value: today.signups },
              { label: "Purchases", value: today.purchases },
              { label: "Revenue", value: `${today.revenue.toLocaleString("vi-VN")}đ` },
            ].map((item) => (
              <div
                key={item.label}
                className="min-w-[120px] rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm"
              >
                <p className="text-xs text-neutral-500">{item.label}</p>
                <p className="text-lg font-bold text-primary">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Charts — lazy loaded to exclude recharts from initial bundle */}
        <AdminChartsSection charts={charts} />

        {/* Section 4: Alerts */}
        <section className="mt-8">
          <h2 className="mb-4 text-sm font-semibold uppercase text-neutral-600">
            Alerts
          </h2>
          <div className="space-y-2">
            {alerts.length === 0 ? (
              <p className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-500">
                Không có cảnh báo.
              </p>
            ) : (
              alerts.map((a, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                    a.severity === "red"
                      ? "border-red-200 bg-red-50"
                      : a.severity === "yellow"
                        ? "border-amber-200 bg-amber-50"
                        : "border-green-200 bg-green-50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {a.severity === "red" && "🔴"}
                    {a.severity === "yellow" && "🟡"}
                    {a.severity === "green" && "🟢"}
                    <span className="text-sm font-medium">{a.message}</span>
                  </span>
                  {a.link && (
                    <Link
                      href={a.link}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Xem chi tiết
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
