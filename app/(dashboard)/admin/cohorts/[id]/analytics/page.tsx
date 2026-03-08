"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface MemberRow {
  enrollment_id: string;
  full_name: string | null;
  status: string;
  current_day: number;
  completion_rate: number;
  current_streak: number;
  last_checkin: string | null;
  risk_score: number;
  risk_level: string;
}

interface CohortData {
  summary: {
    cohort_name: string;
    program_name: string;
    program_slug: string;
    cohort_status: string;
    current_members: number;
    duration_days: number;
    completion_rate: number;
    d7_adherence: number;
    d14_adherence: number;
    avg_current_streak: number;
  };
  daily_checkin_chart: { day_number: number; checkins: number; rate: number }[];
  dropout_hotspots: { day_number: number; dropout_count: number; dropout_rate?: number }[];
  member_list: MemberRow[];
  weekly_feeling_trend: {
    week_number: number;
    avg_feeling: number | null;
    avg_fatigue: number | null;
    avg_difficulty: number | null;
  }[];
}

export default function CohortAnalyticsPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<CohortData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"risk" | "name" | "day" | "completion">("risk");
  const [sortDesc, setSortDesc] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/analytics/cohorts/${id}`);
      if (r.ok) setData(await r.json());
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sortedMembers = useMemo(() => {
    if (!data?.member_list) return [];
    let list = [...data.member_list];
    if (filterStatus) list = list.filter((m) => m.status === filterStatus);
    list.sort((a, b) => {
      const mul = sortDesc ? -1 : 1;
      if (sortBy === "risk") return mul * (a.risk_score - b.risk_score);
      if (sortBy === "name") return mul * ((a.full_name ?? "").localeCompare(b.full_name ?? ""));
      if (sortBy === "day") return mul * (a.current_day - b.current_day);
      if (sortBy === "completion") return mul * (a.completion_rate - b.completion_rate);
      return 0;
    });
    return list;
  }, [data?.member_list, sortBy, sortDesc, filterStatus]);

  const exportCsv = () => {
    if (!sortedMembers.length) return;
    const headers = ["Tên", "Day", "Streak", "Completion %", "Risk", "Last Check-in", "Status"];
    const rows = sortedMembers.map((m) => [
      m.full_name ?? "",
      m.current_day,
      m.current_streak,
      m.completion_rate,
      m.risk_score,
      m.last_checkin ?? "",
      m.status,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cohort-${id}-members.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const riskColor = (level: string) => {
    if (level === "critical") return "bg-red-500 text-white";
    if (level === "high") return "bg-orange-500 text-white";
    if (level === "medium") return "bg-amber-500 text-white";
    return "bg-green-500 text-white";
  };

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
        <p className="text-red-500">Không thể tải dữ liệu cohort.</p>
        <Link href="/admin" className="text-primary hover:underline">← Quay lại</Link>
      </div>
    );
  }

  const s = data.summary as Record<string, unknown>;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-sm text-primary hover:underline">← Dashboard</Link>
            <h1 className="mt-2 font-heading text-2xl font-bold text-primary">
              {s.cohort_name ?? "Cohort"}
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              {s.program_name ?? ""} • {String(s.cohort_status ?? "")} • {Number(s.current_members ?? 0)} members • Ngày {today}
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Completion", value: `${s.completion_rate ?? 0}%` },
            { label: "D7 Adherence", value: `${s.d7_adherence ?? 0}%` },
            { label: "D14 Adherence", value: `${s.d14_adherence ?? 0}%` },
            { label: "Avg Streak", value: String(s.avg_current_streak ?? 0) },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-neutral-500">{k.label}</p>
              <p className="text-xl font-bold text-primary">{k.value}</p>
            </div>
          ))}
        </div>

        {/* Daily Completion Area Chart */}
        <div className="mb-8 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-primary">Daily Completion</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daily_checkin_chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="day_number" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="rate" stroke="#2563eb" fill="#2563eb" fillOpacity={0.3} name="Completion %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Dropout Bar Chart Horizontal */}
        <div className="mb-8 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-primary">Dropout by Day</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[...(data.dropout_hotspots ?? [])].sort((a, b) => (b.dropout_count ?? 0) - (a.dropout_count ?? 0)).slice(0, 15)}
                layout="vertical"
                margin={{ left: 40, right: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="day_number" width={35} tick={{ fontSize: 12 }} tickFormatter={(v) => `D${v}`} />
                <Tooltip />
                <Bar dataKey="dropout_count" name="Dropouts" fill="#dc2626" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly Feeling Trend */}
        <div className="mb-8 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-primary">Weekly Feeling Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.weekly_feeling_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="week_number" tick={{ fontSize: 12 }} tickFormatter={(v) => `W${v}`} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="avg_feeling" name="Progress Feeling" stroke="#2563eb" strokeWidth={2} />
                <Line type="monotone" dataKey="avg_fatigue" name="Fatigue" stroke="#dc2626" strokeWidth={2} />
                <Line type="monotone" dataKey="avg_difficulty" name="Difficulty" stroke="#ca8a04" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Member Table */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <h3 className="font-semibold text-primary">Members</h3>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded border border-neutral-300 px-2 py-1 text-sm"
              >
                <option value="">All status</option>
                <option value="active">active</option>
                <option value="completed">completed</option>
                <option value="dropped">dropped</option>
                <option value="paused">paused</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="rounded border border-neutral-300 px-2 py-1 text-sm"
              >
                <option value="risk">Risk</option>
                <option value="name">Name</option>
                <option value="day">Day</option>
                <option value="completion">Completion</option>
              </select>
              <button
                type="button"
                onClick={() => setSortDesc((d) => !d)}
                className="rounded border px-2 py-1 text-sm"
              >
                {sortDesc ? "↓" : "↑"}
              </button>
              <button
                type="button"
                onClick={exportCsv}
                className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark"
              >
                Export CSV
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead>
                <tr className="bg-neutral-50">
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-neutral-600">Tên</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-neutral-600">Day</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-neutral-600">Streak</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-neutral-600">Completion %</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-neutral-600">Risk</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-neutral-600">Last Check-in</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-neutral-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {sortedMembers.map((m) => (
                  <tr key={m.enrollment_id} className="hover:bg-neutral-50">
                    <td className="whitespace-nowrap px-4 py-2 text-sm">{m.full_name ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-sm">{m.current_day}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-sm">{m.current_streak}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-sm">{m.completion_rate}%</td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${riskColor(m.risk_level)}`}>
                        {m.risk_score}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-sm text-neutral-600">
                      {m.last_checkin ? new Date(m.last_checkin).toLocaleDateString("vi-VN") : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-sm">{m.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
