"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type TabId = "overview" | "codes" | "conversions";

interface OverviewData {
  total_referrals: number;
  total_clicks: number;
  total_signups: number;
  conversion_rate: number;
  total_revenue: number;
  referral_share: number;
  chart_data: { week: string; conversions: number; revenue: number }[];
}

interface CodeRow {
  id: string;
  code: string;
  user_name: string;
  code_type: string;
  clicks: number;
  signups: number;
  conversions: number;
  revenue: number;
  is_active: boolean;
}

interface ConversionRow {
  id: string;
  date: string;
  referrer_name: string;
  referee_name: string;
  program: string;
  amount: number;
  discount: number;
  reward: number;
  status: string;
}

export default function AdminReferralPage() {
  const [tab, setTab] = useState<TabId>("overview");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [codes, setCodes] = useState<{ codes: CodeRow[]; page: number; has_more: boolean }>({
    codes: [],
    page: 0,
    has_more: false,
  });
  const [conversions, setConversions] = useState<{
    conversions: ConversionRow[];
    page: number;
    has_more: boolean;
  }>({ conversions: [], page: 0, has_more: false });
  const [voucherStats, setVoucherStats] = useState<{
    total_issued: number;
    outstanding_amount: number;
    used_count: number;
    expired_count: number;
  } | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const [codeFilters, setCodeFilters] = useState({
    type: "",
    active: "",
    search: "",
  });
  const [conversionFilters, setConversionFilters] = useState({
    status: "",
    date_from: "",
    date_to: "",
  });

  const loadOverview = useCallback(async () => {
    setLoading((l) => ({ ...l, overview: true }));
    try {
      const r = await fetch("/api/admin/referral/overview");
      if (r.ok) {
        const d = await r.json();
        setOverview(d);
        // Voucher stats will be included in overview response when API is ready
        if (d.voucher_stats) setVoucherStats(d.voucher_stats);
      }
    } finally {
      setLoading((l) => ({ ...l, overview: false }));
    }
  }, []);

  const loadCodes = useCallback(
    async (page = 0) => {
      setLoading((l) => ({ ...l, codes: true }));
      try {
        const params = new URLSearchParams({ page: String(page) });
        if (codeFilters.type) params.set("type", codeFilters.type);
        if (codeFilters.active) params.set("active", codeFilters.active);
        if (codeFilters.search) params.set("search", codeFilters.search);
        const r = await fetch(`/api/admin/referral/codes?${params}`);
        if (r.ok) {
          const d = await r.json();
          setCodes({ codes: d.codes ?? [], page: d.page ?? 0, has_more: d.has_more ?? false });
        }
      } finally {
        setLoading((l) => ({ ...l, codes: false }));
      }
    },
    [codeFilters.type, codeFilters.active, codeFilters.search]
  );

  const loadConversions = useCallback(
    async (page = 0) => {
      setLoading((l) => ({ ...l, conversions: true }));
      try {
        const params = new URLSearchParams({ page: String(page) });
        if (conversionFilters.status) params.set("status", conversionFilters.status);
        if (conversionFilters.date_from) params.set("date_from", conversionFilters.date_from);
        if (conversionFilters.date_to) params.set("date_to", conversionFilters.date_to);
        const r = await fetch(`/api/admin/referral/conversions?${params}`);
        if (r.ok) {
          const d = await r.json();
          setConversions({
            conversions: d.conversions ?? [],
            page: d.page ?? 0,
            has_more: d.has_more ?? false,
          });
        }
      } finally {
        setLoading((l) => ({ ...l, conversions: false }));
      }
    },
    [conversionFilters.status, conversionFilters.date_from, conversionFilters.date_to]
  );

  useEffect(() => {
    if (tab === "overview") loadOverview();
  }, [tab, loadOverview]);

  useEffect(() => {
    if (tab === "codes") loadCodes(0);
  }, [tab, loadCodes]);

  useEffect(() => {
    if (tab === "conversions") loadConversions(0);
  }, [tab, loadConversions]);

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Tổng quan" },
    { id: "codes", label: "Referral Codes" },
    { id: "conversions", label: "Conversions" },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-heading text-2xl font-bold text-primary">
          Admin – Referral & Affiliate
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
                    <p className="text-sm text-neutral-500">Tổng referrals</p>
                    <p className="mt-1 text-2xl font-bold text-primary">
                      {overview.total_referrals}
                    </p>
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-neutral-500">Conversion rate</p>
                    <p className="mt-1 text-2xl font-bold text-primary">
                      {overview.conversion_rate}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-neutral-500">Tổng revenue từ referral</p>
                    <p className="mt-1 text-2xl font-bold text-primary">
                      {overview.total_revenue.toLocaleString("vi-VN")}đ
                    </p>
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-neutral-500">Referral share %</p>
                    <p className="mt-1 text-2xl font-bold text-primary">
                      {overview.referral_share}%
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="font-heading text-lg font-semibold text-primary">
                    Voucher Statistics
                  </h3>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                      <p className="text-sm text-neutral-500">Voucher đã phát</p>
                      <p className="mt-1 text-2xl font-bold text-primary">
                        {voucherStats ? voucherStats.total_issued : "–"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                      <p className="text-sm text-neutral-500">Voucher outstanding</p>
                      <p className="mt-1 text-2xl font-bold text-primary">
                        {voucherStats
                          ? `${voucherStats.outstanding_amount.toLocaleString("vi-VN")}đ`
                          : "–"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                      <p className="text-sm text-neutral-500">Voucher đã dùng</p>
                      <p className="mt-1 text-2xl font-bold text-primary">
                        {voucherStats ? voucherStats.used_count : "–"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                      <p className="text-sm text-neutral-500">Voucher hết hạn</p>
                      <p className="mt-1 text-2xl font-bold text-primary">
                        {voucherStats ? voucherStats.expired_count : "–"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                  <h3 className="font-heading font-semibold text-primary">
                    Referral conversions theo tuần
                  </h3>
                  <div className="mt-4 h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overview.chart_data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                        <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(value, name) =>
                            name === "revenue" && typeof value === 'number' ? `${value.toLocaleString("vi-VN")}đ` : (value as string | number)
                          }
                        />
                        <Legend />
                        <Bar
                          dataKey="conversions"
                          name="Conversions"
                          fill="#2563eb"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="revenue"
                          name="Revenue (đ)"
                          fill="#16a34a"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Tab 2: Referral Codes */}
        {tab === "codes" && (
          <div className="mt-8 space-y-4">
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4">
              <select
                value={codeFilters.type}
                onChange={(e) => setCodeFilters((f) => ({ ...f, type: e.target.value }))}
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
              >
                <option value="">Tất cả type</option>
                <option value="referral">referral</option>
                <option value="affiliate">affiliate</option>
              </select>
              <select
                value={codeFilters.active}
                onChange={(e) => setCodeFilters((f) => ({ ...f, active: e.target.value }))}
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
              >
                <option value="">Tất cả</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
              <input
                type="text"
                placeholder="Tìm theo code hoặc user..."
                value={codeFilters.search}
                onChange={(e) => setCodeFilters((f) => ({ ...f, search: e.target.value }))}
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => loadCodes(0)}
                className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark"
              >
                Lọc
              </button>
            </div>

            {loading.codes ? (
              <p className="text-neutral-500">Đang tải...</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead>
                    <tr className="bg-neutral-50">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Code
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        User
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Clicks
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Signups
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Conversions
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Revenue
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Active
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {codes.codes.map((r) => (
                      <tr key={r.id} className="hover:bg-neutral-50">
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">
                          {r.code}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">{r.user_name}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">{r.code_type}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">{r.clicks}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">{r.signups}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">{r.conversions}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          {r.revenue.toLocaleString("vi-VN")}đ
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          {r.is_active ? "✓" : "–"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-2">
                  <p className="text-sm text-neutral-500">{codes.codes.length} bản ghi</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => loadCodes(Math.max(0, codes.page - 1))}
                      disabled={codes.page === 0}
                      className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                    >
                      Trước
                    </button>
                    <button
                      type="button"
                      onClick={() => loadCodes(codes.page + 1)}
                      disabled={!codes.has_more}
                      className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Conversions */}
        {tab === "conversions" && (
          <div className="mt-8 space-y-4">
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4">
              <select
                value={conversionFilters.status}
                onChange={(e) =>
                  setConversionFilters((f) => ({ ...f, status: e.target.value }))
                }
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
              >
                <option value="">Tất cả status</option>
                <option value="signed_up">signed_up</option>
                <option value="converted">converted</option>
                <option value="completed">completed</option>
              </select>
              <input
                type="date"
                value={conversionFilters.date_from}
                onChange={(e) =>
                  setConversionFilters((f) => ({ ...f, date_from: e.target.value }))
                }
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
              />
              <input
                type="date"
                value={conversionFilters.date_to}
                onChange={(e) =>
                  setConversionFilters((f) => ({ ...f, date_to: e.target.value }))
                }
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => loadConversions(0)}
                className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark"
              >
                Lọc
              </button>
            </div>

            {loading.conversions ? (
              <p className="text-neutral-500">Đang tải...</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead>
                    <tr className="bg-neutral-50">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Referrer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Referee
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Program
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Discount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Reward
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {conversions.conversions.map((r) => (
                      <tr key={r.id} className="hover:bg-neutral-50">
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-600">
                          {r.date
                            ? new Date(r.date).toLocaleString("vi-VN")
                            : "–"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">{r.referrer_name}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">{r.referee_name}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">{r.program}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          {r.amount.toLocaleString("vi-VN")}đ
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          {r.discount.toLocaleString("vi-VN")}đ
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          {r.reward.toLocaleString("vi-VN")}đ
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-2">
                  <p className="text-sm text-neutral-500">
                    {conversions.conversions.length} bản ghi
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => loadConversions(Math.max(0, conversions.page - 1))}
                      disabled={conversions.page === 0}
                      className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                    >
                      Trước
                    </button>
                    <button
                      type="button"
                      onClick={() => loadConversions(conversions.page + 1)}
                      disabled={!conversions.has_more}
                      className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
