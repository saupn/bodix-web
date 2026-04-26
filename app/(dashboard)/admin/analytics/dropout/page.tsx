"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface DropoutData {
  programs: { id: string; slug: string; name: string }[];
  dropout_summary: { total_enrollments: number; dropped: number; dropout_rate: number; active: number; completed: number; paused: number };
  dropout_hotspots: { day_number: number; signal_count: number; top_signal: string | null; signal_breakdown: Record<string, number> }[];
  risk_distribution: { low: number; medium: number; high: number; critical: number };
  rescue_effectiveness: { total_interventions: number; returned_count: number; return_rate: number };
}

const PIE_COLORS = ["#16a34a", "#ca8a04", "#f59e0b", "#dc2626"];
const SIGNAL_HINTS: Record<string, string> = {
  missed_2_days: "Bỏ lỡ 2 ngày liên tiếp",
  missed_3_plus_days: "Bỏ lỡ 3+ ngày",
  streak_broken: "Streak bị đứt",
  low_engagement: "Tương tác thấp",
  manual_coach: "Can thiệp thủ công",
};

export default function DropoutAnalyticsPage() {
  const [programSlug, setProgramSlug] = useState("");
  const [data, setData] = useState<DropoutData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const url = programSlug ? `/api/admin/analytics/dropout?program_slug=${programSlug}` : "/api/admin/analytics/dropout";
      const r = await fetch(url);
      if (r.ok) setData(await r.json());
    } finally {
      setLoading(false);
    }
  }, [programSlug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const top3Dropout = (data?.dropout_hotspots ?? []).slice(0, 3);
  const riskPieData = data?.risk_distribution
    ? [
        { name: "Low", value: data.risk_distribution.low, color: PIE_COLORS[0] },
        { name: "Medium", value: data.risk_distribution.medium, color: PIE_COLORS[1] },
        { name: "High", value: data.risk_distribution.high, color: PIE_COLORS[2] },
        { name: "Critical", value: data.risk_distribution.critical, color: PIE_COLORS[3] },
      ].filter((d) => d.value > 0)
    : [];

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

  const heatmapData = [...(data.dropout_hotspots ?? [])]
    .sort((a, b) => a.day_number - b.day_number)
    .map((h) => ({
    day: `D${h.day_number}`,
    count: h.signal_count,
    rate: h.signal_count,
    highlight: h.day_number === 3 || h.day_number === 7 || h.day_number === 14,
  }));

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/admin" className="text-sm text-primary hover:underline">← Dashboard</Link>
        <div className="mt-4 flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold text-primary">Dropout Analytics</h1>
          <select
            value={programSlug}
            onChange={(e) => setProgramSlug(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
          >
            <option value="">Tất cả programs</option>
            {data.programs.map((p) => (
              <option key={p.id} value={p.slug}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Top 3 Dropout Days + Hints */}
        <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-primary">Top 3 Dropout Days</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {top3Dropout.map((h, i) => (
              <div key={h.day_number} className="rounded-lg border border-neutral-200 p-4">
                <p className="text-lg font-bold text-primary">Day {h.day_number}</p>
                <p className="text-sm text-neutral-600">{h.signal_count} signals</p>
                <p className="mt-2 text-xs text-amber-700">
                  Gợi ý: {SIGNAL_HINTS[h.top_signal ?? ""] ?? h.top_signal ?? "–"}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Dropout Heatmap */}
        <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-primary">Dropout Heatmap</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={heatmapData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="Signals" radius={[4, 4, 0, 0]}>
                  {heatmapData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.highlight ? "#dc2626" : "#94a3b8"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-neutral-500">D3, D7, D14 highlighted</p>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* Rescue Effectiveness */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-semibold text-primary">Rescue Effectiveness</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-neutral-50 p-3">
                <p className="text-xs text-neutral-500">Total</p>
                <p className="text-xl font-bold">{data.rescue_effectiveness.total_interventions}</p>
              </div>
              <div className="rounded-lg bg-green-50 p-3">
                <p className="text-xs text-green-700">Returned</p>
                <p className="text-xl font-bold text-green-800">{data.rescue_effectiveness.returned_count}</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3">
                <p className="text-xs text-primary">Rate</p>
                <p className="text-xl font-bold text-primary">{data.rescue_effectiveness.return_rate}%</p>
              </div>
            </div>
          </div>

          {/* Risk Distribution Donut */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-semibold text-primary">Risk Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {riskPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
