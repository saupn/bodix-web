"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface FunnelStep {
  step: string;
  label: string;
  count: number;
  conversion_from_prev: number | null;
}

interface FunnelData {
  funnel_steps: FunnelStep[];
  upgrade_funnel: { path: string; completers: number; upgraded: number; upgrade_rate: number }[];
}

export default function FunnelAnalyticsPage() {
  const [monthA, setMonthA] = useState("");
  const [monthB, setMonthB] = useState("");
  const [dataA, setDataA] = useState<FunnelData | null>(null);
  const [dataB, setDataB] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchFunnel = useCallback(async (month: string | null) => {
    const url = month ? `/api/admin/analytics/funnel?month=${month}` : "/api/admin/analytics/funnel";
    const r = await fetch(url);
    return r.ok ? (await r.json()) : null;
  }, []);

  useEffect(() => {
    if (!monthA && !monthB) {
      fetchFunnel(null).then(setDataA);
      setDataB(null);
      return;
    }
    setLoading(true);
    Promise.all([
      monthA ? fetchFunnel(monthA) : Promise.resolve(null),
      monthB ? fetchFunnel(monthB) : Promise.resolve(null),
    ]).then(([a, b]) => {
      setDataA(a ?? (monthB ? null : (dataA ?? null)));
      setDataB(b);
      setLoading(false);
    });
  }, [monthA, monthB]);

  const steps = (dataA ?? dataB)?.funnel_steps ?? [];
  const maxCount = steps[0]?.count ?? 1;

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/admin" className="text-sm text-primary hover:underline">← Dashboard</Link>
        <div className="mt-4 flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold text-primary">Funnel Analytics</h1>
          <div className="flex gap-4">
            <div>
              <label className="mr-2 text-xs text-neutral-500">Tháng A</label>
              <input
                type="month"
                value={monthA}
                onChange={(e) => setMonthA(e.target.value)}
                className="rounded border border-neutral-300 px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="mr-2 text-xs text-neutral-500">Tháng B</label>
              <input
                type="month"
                value={monthB}
                onChange={(e) => setMonthB(e.target.value)}
                className="rounded border border-neutral-300 px-2 py-1 text-sm"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <p className="mt-8 text-neutral-500">Đang tải...</p>
        ) : (
          <>
            {/* Main Funnel: Signup → Trial → Purchase → Complete */}
            <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-semibold text-primary">Conversion Funnel</h3>
              <div className="space-y-4">
                {steps.map((step, i) => (
                  <div key={step.step} className="flex items-center gap-4">
                    <div className="w-32 text-sm font-medium">{step.label}</div>
                    <div className="flex-1">
                      <div className="flex h-12 items-center rounded-lg bg-neutral-100">
                        <div
                          className="h-full rounded-l-lg bg-primary transition-all"
                          style={{
                            width: `${maxCount > 0 ? (step.count / maxCount) * 100 : 0}%`,
                          }}
                        />
                        <span className="ml-3 text-sm font-medium">{step.count}</span>
                      </div>
                    </div>
                    {step.conversion_from_prev != null && (
                      <span className="w-20 text-right text-sm text-neutral-600">
                        {step.conversion_from_prev}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Month Comparison */}
            {dataA && dataB && monthA && monthB && (
              <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 font-semibold text-primary">Month Comparison</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-neutral-200">
                        <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Step</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-neutral-600">{monthA}</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-neutral-600">{monthB}</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-neutral-600">Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataA.funnel_steps.map((s, i) => {
                        const b = dataB.funnel_steps[i]
                        const delta = b ? s.count - b.count : 0
                        return (
                          <tr key={s.step} className="border-b border-neutral-100">
                            <td className="px-4 py-2 text-sm">{s.label}</td>
                            <td className="px-4 py-2 text-right text-sm">{s.count}</td>
                            <td className="px-4 py-2 text-right text-sm">{b?.count ?? "—"}</td>
                            <td className={`px-4 py-2 text-right text-sm ${delta >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {b != null ? (delta >= 0 ? `+${delta}` : delta) : "—"}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Upgrade Funnel */}
            <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-semibold text-primary">Upgrade Funnel: 21 → 6W → 12W</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {((dataA ?? dataB)?.upgrade_funnel ?? []).map((u) => (
                  <div key={u.path} className="rounded-lg border border-neutral-200 p-4">
                    <p className="font-medium">{u.path}</p>
                    <p className="mt-1 text-sm text-neutral-600">
                      {u.upgraded} / {u.completers} upgraded
                    </p>
                    <p className="mt-1 text-lg font-bold text-primary">{u.upgrade_rate}%</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
