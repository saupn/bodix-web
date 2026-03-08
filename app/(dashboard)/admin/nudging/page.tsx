"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type TabId = "overview" | "risk" | "logs" | "rescue";

interface OverviewData {
  nudgesToday: number;
  rescueToday: number;
  checkinRate: number;
  usersAtRisk: number;
  chartData: { date: string; nudges: number; checkins: number }[];
}

interface RiskRow {
  id: string;
  user_id: string;
  userName: string;
  programName: string;
  day: number;
  streak: number;
  riskScore: number;
  daysMissed: number;
  lastCheckin: string | null;
  status: string;
}

interface NudgeLogRow {
  id: string;
  userName: string;
  nudge_type: string;
  channel: string;
  sent_at: string;
  delivered: boolean;
  opened: boolean;
  led_to_checkin: boolean;
}

interface RescueRow {
  id: string;
  userName: string;
  trigger_reason: string;
  risk_score_at_trigger: number | null;
  action_taken: string;
  outcome: string;
  created_at: string;
}

function riskColor(score: number): string {
  if (score < 20) return "text-green-600";
  if (score < 50) return "text-yellow-600";
  if (score < 80) return "text-orange-600";
  return "text-red-600";
}

function riskBg(score: number): string {
  if (score < 20) return "bg-green-100";
  if (score < 50) return "bg-yellow-100";
  if (score < 80) return "bg-orange-100";
  return "bg-red-100";
}

export default function AdminNudgingPage() {
  const [tab, setTab] = useState<TabId>("overview");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [riskRows, setRiskRows] = useState<RiskRow[]>([]);
  const [nudgeLogs, setNudgeLogs] = useState<{
    rows: NudgeLogRow[];
    total: number;
    page: number;
  }>({ rows: [], total: 0, page: 0 });
  const [rescueData, setRescueData] = useState<{
    rows: RescueRow[];
    outcomes: Record<string, number>;
  }>({ rows: [], outcomes: {} });
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [modalEnrollment, setModalEnrollment] = useState<RiskRow | null>(null);
  const [modalMessage, setModalMessage] = useState("");
  const [modalSending, setModalSending] = useState(false);

  const [nudgeFilters, setNudgeFilters] = useState({
    nudge_type: "",
    channel: "",
    date_from: "",
    date_to: "",
  });
  const [rescueFilters, setRescueFilters] = useState({
    trigger_reason: "",
    outcome: "",
  });

  const loadOverview = useCallback(async () => {
    setLoading((l) => ({ ...l, overview: true }));
    try {
      const r = await fetch("/api/admin/nudging/overview");
      if (r.ok) setOverview(await r.json());
    } finally {
      setLoading((l) => ({ ...l, overview: false }));
    }
  }, []);

  const loadRisk = useCallback(async () => {
    setLoading((l) => ({ ...l, risk: true }));
    try {
      const r = await fetch("/api/admin/nudging/risk-monitor");
      if (r.ok) {
        const { rows } = await r.json();
        setRiskRows(rows ?? []);
      }
    } finally {
      setLoading((l) => ({ ...l, risk: false }));
    }
  }, []);

  const loadNudgeLogs = useCallback(
    async (page = 0) => {
      setLoading((l) => ({ ...l, logs: true }));
      try {
        const params = new URLSearchParams({ page: String(page) });
        if (nudgeFilters.nudge_type) params.set("nudge_type", nudgeFilters.nudge_type);
        if (nudgeFilters.channel) params.set("channel", nudgeFilters.channel);
        if (nudgeFilters.date_from) params.set("date_from", nudgeFilters.date_from);
        if (nudgeFilters.date_to) params.set("date_to", nudgeFilters.date_to);
        const r = await fetch(`/api/admin/nudging/nudge-logs?${params}`);
        if (r.ok) {
          const d = await r.json();
          setNudgeLogs({ rows: d.rows ?? [], total: d.total ?? 0, page: d.page ?? 0 });
        }
      } finally {
        setLoading((l) => ({ ...l, logs: false }));
      }
    },
    [nudgeFilters]
  );

  const loadRescue = useCallback(async () => {
    setLoading((l) => ({ ...l, rescue: true }));
    try {
      const params = new URLSearchParams();
      if (rescueFilters.trigger_reason) params.set("trigger_reason", rescueFilters.trigger_reason);
      if (rescueFilters.outcome) params.set("outcome", rescueFilters.outcome);
      const r = await fetch(`/api/admin/nudging/rescue-history?${params}`);
      if (r.ok) {
        const d = await r.json();
        setRescueData({ rows: d.rows ?? [], outcomes: d.outcomes ?? {} });
      }
    } finally {
      setLoading((l) => ({ ...l, rescue: false }));
    }
  }, [rescueFilters]);

  useEffect(() => {
    if (tab === "overview") loadOverview();
  }, [tab, loadOverview]);

  useEffect(() => {
    if (tab === "risk") loadRisk();
  }, [tab, loadRisk]);

  useEffect(() => {
    if (tab === "logs") loadNudgeLogs(0);
  }, [tab, loadNudgeLogs]);

  useEffect(() => {
    if (tab === "rescue") loadRescue();
  }, [tab, loadRescue]);

  const handleManualIntervention = async () => {
    if (!modalEnrollment || !modalMessage.trim()) return;
    setModalSending(true);
    try {
      const r = await fetch("/api/admin/nudging/manual-intervention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollment_id: modalEnrollment.id,
          message: modalMessage.trim(),
        }),
      });
      if (r.ok) {
        setModalEnrollment(null);
        setModalMessage("");
        loadRisk();
      } else {
        const err = await r.json();
        alert(err.error ?? "Lỗi");
      }
    } finally {
      setModalSending(false);
    }
  };

  const exportCsv = () => {
    const headers = ["User", "Type", "Channel", "Sent At", "Delivered", "Opened", "Led to Check-in"];
    const rows = nudgeLogs.rows.map((r) => [
      r.userName,
      r.nudge_type,
      r.channel,
      r.sent_at,
      r.delivered ? "Yes" : "No",
      r.opened ? "Yes" : "No",
      r.led_to_checkin ? "Yes" : "No",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nudge-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Tổng quan" },
    { id: "risk", label: "Risk Monitor" },
    { id: "logs", label: "Nudge Logs" },
    { id: "rescue", label: "Rescue History" },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-heading text-2xl font-bold text-primary">
          Admin — Hệ thống Nudging
        </h1>

        <div className="mt-6 flex gap-2 border-b border-neutral-200">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-neutral-600 hover:text-primary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Overview */}
        {tab === "overview" && (
          <div className="mt-8 space-y-8">
            {loading.overview ? (
              <p className="text-neutral-500">Đang tải...</p>
            ) : overview ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-neutral-500">Nudges hôm nay</p>
                    <p className="mt-1 text-2xl font-bold text-primary">
                      {overview.nudgesToday}
                    </p>
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-neutral-500">Rescue triggers hôm nay</p>
                    <p className="mt-1 text-2xl font-bold text-primary">
                      {overview.rescueToday}
                    </p>
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-neutral-500">Check-in sau nudge (7 ngày)</p>
                    <p className="mt-1 text-2xl font-bold text-primary">
                      {overview.checkinRate}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-neutral-500">Users at risk</p>
                    <p className="mt-1 text-2xl font-bold text-primary">
                      {overview.usersAtRisk}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                  <h3 className="font-heading font-semibold text-primary">
                    Nudge effectiveness (7 ngày)
                  </h3>
                  <div className="mt-4 h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={overview.chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="nudges"
                          name="Nudges gửi"
                          stroke="#2563eb"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="checkins"
                          name="Check-in sau nudge"
                          stroke="#16a34a"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Tab 2: Risk Monitor */}
        {tab === "risk" && (
          <div className="mt-8">
            {loading.risk ? (
              <p className="text-neutral-500">Đang tải...</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead>
                    <tr className="bg-neutral-50">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        User
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Program
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Day
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Streak
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Risk Score
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Days Missed
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Last Check-in
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-neutral-600">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {riskRows.map((row) => (
                      <tr
                        key={row.id}
                        className={
                          row.riskScore > 60
                            ? "bg-orange-50/50 hover:bg-orange-50"
                            : "hover:bg-neutral-50"
                        }
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-800">
                          {row.userName}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-600">
                          {row.programName}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">{row.day}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">{row.streak}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-flex rounded px-2 py-0.5 text-sm font-medium ${riskBg(row.riskScore)} ${riskColor(row.riskScore)}`}
                          >
                            {row.riskScore}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          {row.daysMissed}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-600">
                          {row.lastCheckin ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">{row.status}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setModalEnrollment(row);
                              setModalMessage("");
                            }}
                            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark"
                          >
                            Can thiệp thủ công
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Nudge Logs */}
        {tab === "logs" && (
          <div className="mt-8 space-y-4">
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4">
              <select
                value={nudgeFilters.nudge_type}
                onChange={(e) =>
                  setNudgeFilters((f) => ({ ...f, nudge_type: e.target.value }))
                }
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
              >
                <option value="">Tất cả type</option>
                <option value="morning_reminder">morning_reminder</option>
                <option value="evening_confirmation">evening_confirmation</option>
                <option value="rescue_soft">rescue_soft</option>
                <option value="rescue_urgent">rescue_urgent</option>
                <option value="rescue_critical">rescue_critical</option>
              </select>
              <select
                value={nudgeFilters.channel}
                onChange={(e) =>
                  setNudgeFilters((f) => ({ ...f, channel: e.target.value }))
                }
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
              >
                <option value="">Tất cả channel</option>
                <option value="email">email</option>
                <option value="zalo">zalo</option>
                <option value="in_app">in_app</option>
              </select>
              <input
                type="date"
                value={nudgeFilters.date_from}
                onChange={(e) =>
                  setNudgeFilters((f) => ({ ...f, date_from: e.target.value }))
                }
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
              />
              <input
                type="date"
                value={nudgeFilters.date_to}
                onChange={(e) =>
                  setNudgeFilters((f) => ({ ...f, date_to: e.target.value }))
                }
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => loadNudgeLogs(0)}
                className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark"
              >
                Lọc
              </button>
              <button
                type="button"
                onClick={exportCsv}
                className="rounded border border-neutral-300 px-4 py-1.5 text-sm font-medium hover:bg-neutral-50"
              >
                Export CSV
              </button>
            </div>

            {loading.logs ? (
              <p className="text-neutral-500">Đang tải...</p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-neutral-200">
                    <thead>
                      <tr className="bg-neutral-50">
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                          User
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                          Channel
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                          Sent At
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                          Delivered
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                          Opened
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                          Led to Check-in
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {nudgeLogs.rows.map((r) => (
                        <tr key={r.id} className="hover:bg-neutral-50">
                          <td className="whitespace-nowrap px-4 py-3 text-sm">{r.userName}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm">{r.nudge_type}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm">{r.channel}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-600">
                            {r.sent_at ? new Date(r.sent_at).toLocaleString("vi-VN") : "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm">
                            {r.delivered ? "✓" : "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm">
                            {r.opened ? "✓" : "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm">
                            {r.led_to_checkin ? "✓" : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-neutral-500">
                    {nudgeLogs.total} bản ghi
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => loadNudgeLogs(Math.max(0, nudgeLogs.page - 1))}
                      disabled={nudgeLogs.page === 0}
                      className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                    >
                      Trước
                    </button>
                    <button
                      type="button"
                      onClick={() => loadNudgeLogs(nudgeLogs.page + 1)}
                      disabled={nudgeLogs.rows.length < 50}
                      className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 4: Rescue History */}
        {tab === "rescue" && (
          <div className="mt-8 space-y-4">
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4">
              <select
                value={rescueFilters.trigger_reason}
                onChange={(e) =>
                  setRescueFilters((f) => ({ ...f, trigger_reason: e.target.value }))
                }
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
              >
                <option value="">Tất cả trigger</option>
                <option value="missed_2_days">missed_2_days</option>
                <option value="missed_3_plus_days">missed_3_plus_days</option>
                <option value="manual_coach">manual_coach</option>
              </select>
              <select
                value={rescueFilters.outcome}
                onChange={(e) =>
                  setRescueFilters((f) => ({ ...f, outcome: e.target.value }))
                }
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
              >
                <option value="">Tất cả outcome</option>
                <option value="user_returned">user_returned</option>
                <option value="user_paused">user_paused</option>
                <option value="user_dropped">user_dropped</option>
                <option value="pending">pending</option>
              </select>
              <button
                type="button"
                onClick={loadRescue}
                className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark"
              >
                Lọc
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-xs text-green-700">Returned</p>
                <p className="text-xl font-bold text-green-800">
                  {rescueData.outcomes.user_returned ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs text-blue-700">Continued Light</p>
                <p className="text-xl font-bold text-blue-800">
                  {rescueData.outcomes.user_continued_light ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                <p className="text-xs text-yellow-700">Paused</p>
                <p className="text-xl font-bold text-yellow-800">
                  {rescueData.outcomes.user_paused ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs text-red-700">Dropped</p>
                <p className="text-xl font-bold text-red-800">
                  {rescueData.outcomes.user_dropped ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <p className="text-xs text-neutral-600">Pending</p>
                <p className="text-xl font-bold text-neutral-800">
                  {rescueData.outcomes.pending ?? 0}
                </p>
              </div>
            </div>

            {loading.rescue ? (
              <p className="text-neutral-500">Đang tải...</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead>
                    <tr className="bg-neutral-50">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        User
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Trigger
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Risk Score
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Action
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Outcome
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {rescueData.rows.map((r) => (
                      <tr key={r.id} className="hover:bg-neutral-50">
                        <td className="whitespace-nowrap px-4 py-3 text-sm">{r.userName}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">{r.trigger_reason}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          {r.risk_score_at_trigger ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">{r.action_taken}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">{r.outcome}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-600">
                          {r.created_at
                            ? new Date(r.created_at).toLocaleString("vi-VN")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Manual intervention */}
      {modalEnrollment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-heading font-semibold text-primary">
              Can thiệp thủ công — {modalEnrollment.userName}
            </h3>
            <p className="mt-1 text-sm text-neutral-600">
              {modalEnrollment.programName} • Ngày {modalEnrollment.day}
            </p>
            <textarea
              value={modalMessage}
              onChange={(e) => setModalMessage(e.target.value)}
              placeholder="Nhập nội dung message gửi cho user..."
              rows={4}
              className="mt-4 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModalEnrollment(null);
                  setModalMessage("");
                }}
                className="rounded border px-4 py-2 text-sm font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleManualIntervention}
                disabled={!modalMessage.trim() || modalSending}
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {modalSending ? "Đang gửi..." : "Gửi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
