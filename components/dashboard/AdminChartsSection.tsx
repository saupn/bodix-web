"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ChartsData {
  completion_daily: { date: string; rate_21: number; rate_6w: number; rate_12w: number }[];
  revenue_monthly: { month: string; bodix21: number; bodix6w: number; bodix12w: number; referral: number; total: number }[];
  funnel: { step: string; count: number; conversion: number | null }[];
  dropout: { day: number; count: number; rate: number; highlight: boolean }[];
}

export default function AdminChartsSection({ charts }: { charts: ChartsData }) {
  const [chartTab, setChartTab] = useState<"completion" | "revenue" | "funnel" | "dropout">("completion");

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-sm font-semibold uppercase text-neutral-600">
        Charts
      </h2>
      <div className="flex gap-2 border-b border-neutral-200">
        {(["completion", "revenue", "funnel", "dropout"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setChartTab(t)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              chartTab === t
                ? "border-primary text-primary"
                : "border-transparent text-neutral-600 hover:text-primary"
            }`}
          >
            {t === "completion" && "Completion"}
            {t === "revenue" && "Revenue"}
            {t === "funnel" && "Funnel"}
            {t === "dropout" && "Dropout"}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        {chartTab === "completion" && (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.completion_daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="rate_21" name="21 ngày" stroke="#2563eb" strokeWidth={2} />
                <Line type="monotone" dataKey="rate_6w" name="6W" stroke="#16a34a" strokeWidth={2} />
                <Line type="monotone" dataKey="rate_12w" name="12W" stroke="#ca8a04" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {chartTab === "revenue" && (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={charts.revenue_monthly} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                <Tooltip formatter={(v) => typeof v === 'number' ? `${v.toLocaleString("vi-VN")}đ` : v} />
                <Legend />
                <Bar dataKey="bodix21" name="BodiX 21" stackId="a" fill="#2563eb" radius={[0, 0, 0, 0]} />
                <Bar dataKey="bodix6w" name="BodiX 6W" stackId="a" fill="#16a34a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="bodix12w" name="BodiX 12W" stackId="a" fill="#ca8a04" radius={[0, 0, 0, 0]} />
                <Line type="monotone" dataKey="referral" name="Referral" stroke="#a855f7" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {chartTab === "funnel" && (
          <div className="flex flex-col gap-4">
            {charts.funnel.map((step) => (
              <div key={step.step} className="flex items-center gap-4">
                <div className="w-24 text-sm font-medium">{step.step}</div>
                <div className="flex-1">
                  <div className="flex h-10 items-center rounded-lg bg-neutral-100">
                    <div
                      className="h-full rounded-lg bg-primary transition-all"
                      style={{
                        width: `${charts.funnel[0]?.count ? (step.count / charts.funnel[0].count) * 100 : 0}%`,
                      }}
                    />
                    <span className="ml-2 text-sm font-medium">{step.count}</span>
                  </div>
                </div>
                {step.conversion != null && (
                  <span className="w-16 text-right text-sm text-neutral-600">
                    {step.conversion}%
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {chartTab === "dropout" && (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.dropout} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="Dropout count" radius={[4, 4, 0, 0]}>
                  {charts.dropout.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.highlight ? "#dc2626" : entry.rate > 50 ? "#f59e0b" : "#94a3b8"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-neutral-600">
              D3, D7, D14 highlighted in red
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
