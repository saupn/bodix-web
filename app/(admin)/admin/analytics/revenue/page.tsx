"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";

interface RevenueData {
  summary: {
    mrr: number;
    arr_estimate: number;
    mom_growth_percent: number | null;
    total_revenue_period: number;
    referral_revenue_period: number;
    referral_share_period: number;
  };
  monthly_by_program: { month_short: string; bodix21: number; bodix6w: number; bodix12w: number; referral: number; total: number }[];
  monthly_chart: { month: string; total_revenue: number; avg_order_value: number }[];
  revenue_by_program: { slug: string; name: string; revenue: number; purchases: number }[];
}

const PERIODS = [3, 6, 12, 24];
const PIE_COLORS = ["#2563eb", "#16a34a", "#ca8a04", "#a855f7"];

export default function RevenueAnalyticsPage() {
  const [period, setPeriod] = useState(6);
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/analytics/revenue?months=${period}`);
      if (r.ok) setData(await r.json());
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const cumulativeData = data?.monthly_by_program
    ? data.monthly_by_program.reduce(
        (acc: { month_short: string; cumulative: number }[], row, i) => {
          const prev = acc[i - 1]?.cumulative ?? 0;
          acc.push({ month_short: row.month_short, cumulative: prev + row.total });
          return acc;
        },
        []
      )
    : [];

  const pieData = data?.revenue_by_program.map((p, i) => ({
    name: p.name,
    value: p.revenue,
    color: PIE_COLORS[i % PIE_COLORS.length],
  })) ?? [];

  if (loading && !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-neutral-500">Đang tải...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <p className="text-red-500">Không thể tải dữ liệu.</p>
        <Link href="/admin" className="text-primary hover:underline">← Quay lại</Link>
      </div>
    );
  }

  const s = data.summary;
  const aov = data.monthly_chart?.length
    ? data.monthly_chart.reduce((sum, m) => sum + (m.avg_order_value ?? 0), 0) / data.monthly_chart.length
    : 0;

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/admin" className="text-sm text-primary hover:underline">← Dashboard</Link>
        <div className="mt-4 flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold text-primary">Revenue Analytics</h1>
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>{p} tháng</option>
            ))}
          </select>
        </div>

        {/* Cards */}
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-neutral-500">Total Revenue</p>
            <p className="text-xl font-bold text-primary">{s.total_revenue_period.toLocaleString("vi-VN")}đ</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-neutral-500">AOV</p>
            <p className="text-xl font-bold text-primary">{Math.round(aov).toLocaleString("vi-VN")}đ</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-neutral-500">MoM Growth</p>
            <p className={`text-xl font-bold ${(s.mom_growth_percent ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
              {s.mom_growth_percent != null ? `${s.mom_growth_percent}%` : "–"}
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-neutral-500">Referral %</p>
            <p className="text-xl font-bold text-primary">{s.referral_share_period}%</p>
          </div>
        </div>

        {/* Monthly Stacked Bar */}
        <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-primary">Revenue by Program (Monthly)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthly_by_program} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="month_short" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                <Tooltip formatter={(v) => typeof v === 'number' ? `${v.toLocaleString("vi-VN")}đ` : v} />
                <Legend />
                <Bar dataKey="bodix21" name="BodiX 21" stackId="a" fill="#2563eb" radius={[0, 0, 0, 0]} />
                <Bar dataKey="bodix6w" name="BodiX 6W" stackId="a" fill="#16a34a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="bodix12w" name="BodiX 12W" stackId="a" fill="#ca8a04" radius={[0, 0, 0, 0]} />
                <Bar dataKey="referral" name="Referral" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* Revenue by Source Pie */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-semibold text-primary">Revenue by Source</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => typeof v === 'number' ? `${v.toLocaleString("vi-VN")}đ` : v} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cumulative Line */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-semibold text-primary">Cumulative Revenue</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="month_short" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                  <Tooltip formatter={(v) => typeof v === 'number' ? `${v.toLocaleString("vi-VN")}đ` : v} />
                  <Line type="monotone" dataKey="cumulative" stroke="#2563eb" strokeWidth={2} name="Cumulative" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
