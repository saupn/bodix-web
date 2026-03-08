"use client";

import { useEffect, useState, useCallback } from "react";

type TabId = "applications" | "active" | "withdrawals" | "payouts";

interface AffiliateRow {
  affiliate_id: string;
  user_id: string;
  full_name: string;
  affiliate_tier: string;
  social_channels: unknown[];
  max_followers: number;
  motivation: string | null;
  stats: { total_earned: number; total_paid: number; pending_balance: number };
  code: {
    code: string;
    commission_rate: number;
    link: string;
    conversions?: number;
    revenue?: number;
    is_active?: boolean;
  } | null;
}

interface WithdrawalRow {
  id: string;
  affiliate_name: string;
  user_id: string;
  amount: number;
  bank_name: string;
  bank_account: string;
  bank_account_name: string;
  requested_at: string;
  status: string;
}

interface PayoutMonth {
  month: string;
  label: string;
  total: number;
  count: number;
  items: { id: string; user_id: string; amount: number; paid_at: string; affiliate_name: string }[];
}

export default function AdminAffiliatePage() {
  const [tab, setTab] = useState<TabId>("applications");
  const [applications, setApplications] = useState<AffiliateRow[]>([]);
  const [activeAffiliates, setActiveAffiliates] = useState<AffiliateRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<{
    withdrawals: WithdrawalRow[];
    page: number;
    has_more: boolean;
  }>({ withdrawals: [], page: 0, has_more: false });
  const [payouts, setPayouts] = useState<{
    summary: PayoutMonth[];
    grand_total: number;
    year: number;
  }>({ summary: [], grand_total: 0, year: new Date().getFullYear() });
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState("pending");

  const [modalApprove, setModalApprove] = useState<AffiliateRow | null>(null);
  const [modalReject, setModalReject] = useState<AffiliateRow | null>(null);
  const [modalCommission, setModalCommission] = useState<AffiliateRow | null>(null);
  const [modalTier, setModalTier] = useState<AffiliateRow | null>(null);
  const [modalRejectReason, setModalRejectReason] = useState("");
  const [modalCommissionRate, setModalCommissionRate] = useState("");
  const [modalTierValue, setModalTierValue] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadApplications = useCallback(async () => {
    setLoading((l) => ({ ...l, applications: true }));
    try {
      const r = await fetch("/api/admin/affiliate?status=pending");
      if (r.ok) {
        const d = await r.json();
        setApplications(d.affiliates ?? []);
      }
    } finally {
      setLoading((l) => ({ ...l, applications: false }));
    }
  }, []);

  const loadActiveAffiliates = useCallback(async () => {
    setLoading((l) => ({ ...l, active: true }));
    try {
      const r = await fetch("/api/admin/affiliate?status=approved");
      if (r.ok) {
        const d = await r.json();
        setActiveAffiliates(d.affiliates ?? []);
      }
    } finally {
      setLoading((l) => ({ ...l, active: false }));
    }
  }, []);

  const loadWithdrawals = useCallback(
    async (page = 0) => {
      setLoading((l) => ({ ...l, withdrawals: true }));
      try {
        const params = new URLSearchParams({ page: String(page) });
        if (withdrawalStatusFilter) params.set("status", withdrawalStatusFilter);
        const r = await fetch(`/api/admin/affiliate/withdrawals?${params}`);
        if (r.ok) {
          const d = await r.json();
          setWithdrawals({
            withdrawals: d.withdrawals ?? [],
            page: d.page ?? 0,
            has_more: d.has_more ?? false,
          });
        }
      } finally {
        setLoading((l) => ({ ...l, withdrawals: false }));
      }
    },
    [withdrawalStatusFilter]
  );

  const loadPayouts = useCallback(async () => {
    setLoading((l) => ({ ...l, payouts: true }));
    try {
      const r = await fetch(`/api/admin/affiliate/payouts?year=${payouts.year}`);
      if (r.ok) {
        const d = await r.json();
        setPayouts({
          summary: d.summary ?? [],
          grand_total: d.grand_total ?? 0,
          year: d.year ?? payouts.year,
        });
      }
    } finally {
      setLoading((l) => ({ ...l, payouts: false }));
    }
  }, [payouts.year]);

  useEffect(() => {
    if (tab === "applications") loadApplications();
  }, [tab, loadApplications]);

  useEffect(() => {
    if (tab === "active") loadActiveAffiliates();
  }, [tab, loadActiveAffiliates]);

  useEffect(() => {
    if (tab === "withdrawals") loadWithdrawals(0);
  }, [tab, loadWithdrawals]);

  useEffect(() => {
    if (tab === "payouts") loadPayouts();
  }, [tab, loadPayouts]);

  const handleApprove = async () => {
    if (!modalApprove) return;
    const rate = parseInt(modalCommissionRate || "15", 10);
    if (rate < 1 || rate > 50) {
      alert("Commission rate phải từ 1–50%");
      return;
    }
    setActionLoading(true);
    try {
      const r = await fetch("/api/admin/affiliate", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          affiliate_id: modalApprove.affiliate_id,
          action: "approve",
          commission_rate: rate,
        }),
      });
      if (r.ok) {
        setModalApprove(null);
        setModalCommissionRate("");
        loadApplications();
      } else {
        const err = await r.json();
        alert(err.error ?? "Lỗi");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!modalReject) return;
    setActionLoading(true);
    try {
      const r = await fetch("/api/admin/affiliate", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          affiliate_id: modalReject.affiliate_id,
          action: "reject",
          reason: modalRejectReason.trim() || undefined,
        }),
      });
      if (r.ok) {
        setModalReject(null);
        setModalRejectReason("");
        loadApplications();
      } else {
        const err = await r.json();
        alert(err.error ?? "Lỗi");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateCommission = async () => {
    if (!modalCommission) return;
    const rate = parseInt(modalCommissionRate || "0", 10);
    if (rate < 1 || rate > 50) {
      alert("Commission rate phải từ 1–50%");
      return;
    }
    setActionLoading(true);
    try {
      const r = await fetch("/api/admin/affiliate/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          affiliate_id: modalCommission.affiliate_id,
          commission_rate: rate,
        }),
      });
      if (r.ok) {
        setModalCommission(null);
        setModalCommissionRate("");
        loadActiveAffiliates();
      } else {
        const err = await r.json();
        alert(err.error ?? "Lỗi");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateTier = async () => {
    if (!modalTier || !modalTierValue) return;
    setActionLoading(true);
    try {
      const r = await fetch("/api/admin/affiliate/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          affiliate_id: modalTier.affiliate_id,
          tier: modalTierValue,
        }),
      });
      if (r.ok) {
        setModalTier(null);
        setModalTierValue("");
        loadActiveAffiliates();
      } else {
        const err = await r.json();
        alert(err.error ?? "Lỗi");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async (aff: AffiliateRow) => {
    if (!confirm("Tạm dừng affiliate này?")) return;
    setActionLoading(true);
    try {
      const r = await fetch("/api/admin/affiliate/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          affiliate_id: aff.affiliate_id,
          pause: true,
        }),
      });
      if (r.ok) loadActiveAffiliates();
      else alert((await r.json()).error ?? "Lỗi");
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdrawalApprove = async (id: string) => {
    setActionLoading(true);
    try {
      const r = await fetch("/api/admin/affiliate/withdrawals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawal_id: id, action: "approve" }),
      });
      if (r.ok) loadWithdrawals(0);
      else alert((await r.json()).error ?? "Lỗi");
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdrawalReject = async (id: string) => {
    const reason = prompt("Nhập lý do từ chối:");
    if (reason === null) return;
    setActionLoading(true);
    try {
      const r = await fetch("/api/admin/affiliate/withdrawals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawal_id: id, action: "reject", reason }),
      });
      if (r.ok) loadWithdrawals(0);
      else alert((await r.json()).error ?? "Lỗi");
    } finally {
      setActionLoading(false);
    }
  };

  const exportPayoutsCsv = () => {
    const rows: string[][] = [];
    for (const m of payouts.summary) {
      for (const i of m.items) {
        rows.push([
          m.label,
          i.affiliate_name,
          i.user_id,
          String(i.amount),
          i.paid_at ? new Date(i.paid_at).toISOString() : "",
        ]);
      }
    }
    const headers = ["Tháng", "Affiliate", "User ID", "Số tiền (VND)", "Ngày thanh toán"];
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `payouts-${payouts.year}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "applications", label: "Đơn đăng ký" },
    { id: "active", label: "Affiliates đang hoạt động" },
    { id: "withdrawals", label: "Rút tiền" },
    { id: "payouts", label: "Payouts" },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-heading text-2xl font-bold text-primary">
          Admin — Affiliate
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

        {/* Tab 1: Applications */}
        {tab === "applications" && (
          <div className="mt-8">
            {loading.applications ? (
              <p className="text-neutral-500">Đang tải...</p>
            ) : (
              <div className="space-y-4">
                {applications.length === 0 ? (
                  <p className="text-neutral-500">Không có đơn đăng ký chờ duyệt.</p>
                ) : (
                  applications.map((a) => (
                    <div
                      key={a.affiliate_id}
                      className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-neutral-800">{a.full_name}</h3>
                          <p className="mt-1 text-sm text-neutral-600">
                            Social: {Array.isArray(a.social_channels) ? a.social_channels.map((c: { platform?: string; followers?: number }) => `${c.platform ?? ''} (${c.followers ?? 0} followers)`).join(", ") : "—"}
                          </p>
                          <p className="mt-1 text-sm text-neutral-600">
                            Followers: {a.max_followers?.toLocaleString() ?? "—"}
                          </p>
                          <p className="mt-1 text-sm text-neutral-500">
                            Motivation: {a.motivation ?? "—"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setModalApprove(a);
                              setModalCommissionRate("15");
                            }}
                            className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => setModalReject(a)}
                            className="rounded border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Active Affiliates */}
        {tab === "active" && (
          <div className="mt-8">
            {loading.active ? (
              <p className="text-neutral-500">Đang tải...</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead>
                    <tr className="bg-neutral-50">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Affiliate
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Tier
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Commission %
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Conversions
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Revenue
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Earned
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Pending
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Paid
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-neutral-600">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {activeAffiliates.map((a) => (
                      <tr key={a.affiliate_id} className="hover:bg-neutral-50">
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">
                          {a.full_name}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">{a.affiliate_tier}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          {a.code?.commission_rate ?? "—"}%
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          {a.code?.conversions ?? 0}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          {(a.code?.revenue ?? 0).toLocaleString("vi-VN")}đ
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          {(a.stats?.total_earned ?? 0).toLocaleString("vi-VN")}đ
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          {(a.stats?.pending_balance ?? 0).toLocaleString("vi-VN")}đ
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          {(a.stats?.total_paid ?? 0).toLocaleString("vi-VN")}đ
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setModalCommission(a);
                                setModalCommissionRate(String(a.code?.commission_rate ?? 15));
                              }}
                              className="rounded border px-2 py-1 text-xs font-medium hover:bg-neutral-50"
                            >
                              Điều chỉnh commission
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setModalTier(a);
                                setModalTierValue(a.affiliate_tier ?? "basic");
                              }}
                              className="rounded border px-2 py-1 text-xs font-medium hover:bg-neutral-50"
                            >
                              Nâng tier
                            </button>
                            {a.code?.is_active !== false && (
                              <button
                                type="button"
                                onClick={() => handlePause(a)}
                                className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50"
                              >
                                Pause
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Withdrawals */}
        {tab === "withdrawals" && (
          <div className="mt-8 space-y-4">
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4">
              <select
                value={withdrawalStatusFilter}
                onChange={(e) => setWithdrawalStatusFilter(e.target.value)}
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
              >
                <option value="">Tất cả</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="rejected">Rejected</option>
              </select>
              <button
                type="button"
                onClick={() => loadWithdrawals(0)}
                className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark"
              >
                Lọc
              </button>
            </div>

            {loading.withdrawals ? (
              <p className="text-neutral-500">Đang tải...</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead>
                    <tr className="bg-neutral-50">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Affiliate
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Bank
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Requested
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
                    {withdrawals.withdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-neutral-50">
                        <td className="whitespace-nowrap px-4 py-3 text-sm">{w.affiliate_name}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          {w.amount.toLocaleString("vi-VN")}đ
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          {w.bank_name} {w.bank_account} ({w.bank_account_name})
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-600">
                          {w.requested_at ? new Date(w.requested_at).toLocaleString("vi-VN") : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">{w.status}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {w.status === "pending" && (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleWithdrawalApprove(w.id)}
                                disabled={actionLoading}
                                className="rounded bg-primary px-3 py-1 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
                              >
                                Xác nhận đã thanh toán
                              </button>
                              <button
                                type="button"
                                onClick={() => handleWithdrawalReject(w.id)}
                                disabled={actionLoading}
                                className="rounded border border-neutral-300 px-3 py-1 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
                              >
                                Từ chối
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Payouts */}
        {tab === "payouts" && (
          <div className="mt-8 space-y-4">
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4">
              <input
                type="number"
                value={payouts.year}
                onChange={(e) => setPayouts((p) => ({ ...p, year: parseInt(e.target.value, 10) || new Date().getFullYear() }))}
                className="w-24 rounded border border-neutral-300 px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={loadPayouts}
                className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark"
              >
                Xem
              </button>
              <button
                type="button"
                onClick={exportPayoutsCsv}
                className="rounded border border-neutral-300 px-4 py-1.5 text-sm font-medium hover:bg-neutral-50"
              >
                Export CSV
              </button>
            </div>

            {loading.payouts ? (
              <p className="text-neutral-500">Đang tải...</p>
            ) : (
              <div className="space-y-4">
                <p className="text-lg font-semibold">
                  Tổng thanh toán {payouts.year}: {payouts.grand_total.toLocaleString("vi-VN")}đ
                </p>
                <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-neutral-200">
                    <thead>
                      <tr className="bg-neutral-50">
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                          Tháng
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                          Số giao dịch
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                          Tổng
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {payouts.summary.map((m) => (
                        <tr key={m.month} className="hover:bg-neutral-50">
                          <td className="whitespace-nowrap px-4 py-3 text-sm">{m.label}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm">{m.count}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm">
                            {m.total.toLocaleString("vi-VN")}đ
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Approve */}
      {modalApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-heading font-semibold text-primary">
              Duyệt affiliate — {modalApprove.full_name}
            </h3>
            <label className="mt-4 block text-sm font-medium">
              Commission rate (%)
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={modalCommissionRate}
              onChange={(e) => setModalCommissionRate(e.target.value)}
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModalApprove(null);
                  setModalCommissionRate("");
                }}
                className="rounded border px-4 py-2 text-sm font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={actionLoading}
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {actionLoading ? "Đang xử lý..." : "Approve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reject */}
      {modalReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-heading font-semibold text-primary">
              Từ chối — {modalReject.full_name}
            </h3>
            <label className="mt-4 block text-sm font-medium">
              Lý do (tùy chọn)
            </label>
            <textarea
              value={modalRejectReason}
              onChange={(e) => setModalRejectReason(e.target.value)}
              placeholder="Nhập lý do từ chối..."
              rows={3}
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModalReject(null);
                  setModalRejectReason("");
                }}
                className="rounded border px-4 py-2 text-sm font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoading}
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? "Đang xử lý..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Commission */}
      {modalCommission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-heading font-semibold text-primary">
              Điều chỉnh commission — {modalCommission.full_name}
            </h3>
            <label className="mt-4 block text-sm font-medium">
              Commission rate (%)
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={modalCommissionRate}
              onChange={(e) => setModalCommissionRate(e.target.value)}
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModalCommission(null);
                  setModalCommissionRate("");
                }}
                className="rounded border px-4 py-2 text-sm font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleUpdateCommission}
                disabled={actionLoading}
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {actionLoading ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tier */}
      {modalTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-heading font-semibold text-primary">
              Nâng tier — {modalTier.full_name}
            </h3>
            <label className="mt-4 block text-sm font-medium">
              Tier
            </label>
            <select
              value={modalTierValue}
              onChange={(e) => setModalTierValue(e.target.value)}
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="basic">Basic (15%)</option>
              <option value="silver">Silver (18%)</option>
              <option value="gold">Gold (20%)</option>
              <option value="platinum">Platinum (25%)</option>
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModalTier(null);
                  setModalTierValue("");
                }}
                className="rounded border px-4 py-2 text-sm font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleUpdateTier}
                disabled={actionLoading}
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {actionLoading ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
