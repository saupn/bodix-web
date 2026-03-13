"use client";

import { useEffect, useState, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Plus, Trash2 } from "lucide-react";
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

const PARTNER_BASE = "https://bodix.vn/p";
const COMMISSION_RATE = 40;
const MIN_WITHDRAWAL = 200_000;
const TIER_LABEL: Record<string, string> = {
  basic: "🥉 Basic",
  silver: "🥈 Silver",
  gold: "🥇 Gold",
  platinum: "💎 Platinum",
};
const PLATFORM_OPTIONS = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "other", label: "Khác" },
];

interface StatusData {
  has_profile: boolean;
  is_approved: boolean;
  tier?: string;
  has_bank_info?: boolean;
}

interface DashboardData {
  profile: {
    tier: string;
    commission_rate: number;
    full_name: string | null;
  };
  code: { code: string; link: string } | null;
  stats: {
    total_revenue: number;
    total_earned: number;
    pending_balance: number;
    paid_total: number;
    this_month_revenue: number;
    this_month_commission: number;
  };
  recent_conversions: {
    date: string;
    referee_name: string;
    program: string;
    amount: number;
    commission: number;
    status: string;
  }[];
  monthly_chart: { month: string; conversions: number; revenue: number; commission: number }[];
  bank_info: {
    bank_name: string | null;
    bank_account_number: string | null;
    bank_account_name: string | null;
  };
  withdrawal_history: { id: string; amount: number; created_at: string; description: string }[];
}

interface SocialChannel {
  platform: string;
  url: string;
  followers: number;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AffiliatePage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  // Apply form state
  const [socialChannels, setSocialChannels] = useState<SocialChannel[]>([
    { platform: "instagram", url: "", followers: 0 },
  ]);
  const [motivation, setMotivation] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [editBank, setEditBank] = useState({ bank_name: "", bank_account_number: "", bank_account_name: "" });
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  // Chart year
  const [chartYear, setChartYear] = useState(new Date().getFullYear());

  const partnerLink = dashboard?.code
    ? `${PARTNER_BASE}/${dashboard.code.code}`
    : "";
  const shareMessage = dashboard?.code
    ? `Mình đang tập BodiX — chương trình fitness hoàn thành được! 💪\nDùng link của mình để giảm 10% chương trình đầu tiên.\n👉 ${partnerLink}`
    : "";

  useEffect(() => {
    const load = async () => {
      try {
        const statusRes = await fetch("/api/affiliate/status");
        if (statusRes.ok) {
          const s = await statusRes.json();
          setStatus(s);
          if (s.is_approved) {
            const dashRes = await fetch(`/api/affiliate/dashboard?year=${chartYear}`);
            if (dashRes.ok) {
              const d = await dashRes.json();
              setDashboard(d);
              setEditBank({
                bank_name: d.bank_info?.bank_name ?? "",
                bank_account_number: d.bank_info?.bank_account_number ?? "",
                bank_account_name: d.bank_info?.bank_account_name ?? "",
              });
            }
          }
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [chartYear]);

  const copyToClipboard = async (text: string, key: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  };

  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `bodix-affiliate-${dashboard?.code?.code ?? "qr"}.png`;
    a.click();
  };

  const addSocialChannel = () => {
    setSocialChannels((prev) => [...prev, { platform: "instagram", url: "", followers: 0 }]);
  };
  const removeSocialChannel = (i: number) => {
    setSocialChannels((prev) => prev.filter((_, j) => j !== i));
  };
  const updateSocialChannel = (i: number, field: keyof SocialChannel, value: string | number) => {
    setSocialChannels((prev) =>
      prev.map((ch, j) => (j === i ? { ...ch, [field]: value } : ch))
    );
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplySubmitting(true);
    setApplyError(null);
    setApplySuccess(false);
    try {
      const res = await fetch("/api/affiliate/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          social_channels: socialChannels.filter((ch) => ch.platform && ch.url),
          motivation: motivation.trim(),
          bank_name: bankName.trim() || undefined,
          bank_account_number: bankAccount.trim() || undefined,
          bank_account_name: bankAccountName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.status === "pending_review") {
        setApplySuccess(true);
        setStatus({ has_profile: true, is_approved: false });
      } else {
        setApplyError(data.error ?? "Không thể gửi đăng ký.");
      }
    } finally {
      setApplySubmitting(false);
    }
  };

  const handleUpdateBank = async () => {
    const res = await fetch("/api/affiliate/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editBank),
    });
    if (res.ok && dashboard) {
      setDashboard({
        ...dashboard,
        bank_info: { ...editBank },
      });
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(withdrawAmount.replace(/\D/g, ""), 10);
    if (!amount || amount < MIN_WITHDRAWAL) {
      setWithdrawError(`Số tiền tối thiểu ${MIN_WITHDRAWAL.toLocaleString("vi-VN")}đ`);
      return;
    }
    setWithdrawSubmitting(true);
    setWithdrawError(null);
    setWithdrawSuccess(false);
    try {
      const res = await fetch("/api/affiliate/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (res.ok) {
        setWithdrawSuccess(true);
        setWithdrawAmount("");
        const dashRes = await fetch(`/api/affiliate/dashboard?year=${chartYear}`);
        if (dashRes.ok) setDashboard(await dashRes.json());
      } else {
        setWithdrawError(data.error ?? "Không thể rút tiền.");
      }
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-neutral-500">Đang tải...</p>
      </div>
    );
  }

  // ── Chưa có affiliate: trang đăng ký ─────────────────────────────────────
  if (!status?.has_profile) {
    return (
      <div className="mx-auto max-w-2xl space-y-8 pb-16">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
            Trở thành Đối tác BodiX 🤝
          </h1>
          <p className="mt-2 text-neutral-600">
            Nhận {COMMISSION_RATE}% mỗi đơn hàng qua link của bạn
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="font-heading font-semibold text-primary">Điều kiện</h2>
          <ul className="mt-2 list-inside list-disc text-neutral-600">
            <li>Đã hoàn thành ít nhất 1 chương trình BodiX</li>
            <li>Hoặc có 1.000+ followers trên mạng xã hội</li>
          </ul>
        </div>

        {applySuccess ? (
          <div className="rounded-xl border-2 border-green-200 bg-green-50 p-6 text-center">
            <p className="font-medium text-green-800">
              Đăng ký đang được xem xét. Chúng tôi sẽ phản hồi trong 24h.
            </p>
          </div>
        ) : (
          <form onSubmit={handleApply} className="space-y-6 rounded-xl border border-neutral-200 bg-white p-6">
            <h2 className="font-heading font-semibold text-primary">Đăng ký</h2>

            <div>
              <label className="block text-sm font-medium">Kênh mạng xã hội</label>
              {socialChannels.map((ch, i) => (
                <div key={i} className="mt-2 flex flex-wrap gap-2">
                  <select
                    value={ch.platform}
                    onChange={(e) => updateSocialChannel(i, "platform", e.target.value)}
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  >
                    {PLATFORM_OPTIONS.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                  <input
                    type="url"
                    placeholder="URL"
                    value={ch.url}
                    onChange={(e) => updateSocialChannel(i, "url", e.target.value)}
                    className="flex-1 min-w-[120px] rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Followers"
                    value={ch.followers || ""}
                    onChange={(e) => updateSocialChannel(i, "followers", parseInt(e.target.value, 10) || 0)}
                    className="w-24 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeSocialChannel(i)}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addSocialChannel}
                className="mt-2 flex items-center gap-2 text-sm font-medium text-primary"
              >
                <Plus className="h-4 w-4" /> Thêm kênh
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium">Lý do muốn làm affiliate</label>
              <textarea
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                rows={4}
                required
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                placeholder="Chia sẻ lý do của bạn..."
              />
            </div>

            <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-4">
              <p className="text-sm font-medium text-neutral-600">Thông tin ngân hàng (tùy chọn, điền sau)</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  placeholder="Ngân hàng"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Số tài khoản"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Tên chủ tài khoản"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {applyError && <p className="text-sm text-red-600">{applyError}</p>}
            <button
              type="submit"
              disabled={applySubmitting}
              className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {applySubmitting ? "Đang gửi..." : "Gửi đăng ký"}
            </button>
          </form>
        )}
      </div>
    );
  }

  // ── Đã đăng ký nhưng chưa duyệt ─────────────────────────────────────────
  if (!status?.is_approved) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border-2 border-amber-200 bg-amber-50 p-8 text-center">
        <h1 className="font-heading text-xl font-bold text-amber-900">
          Đơn đăng ký đang chờ duyệt
        </h1>
        <p className="mt-4 text-amber-800">
          Chúng tôi sẽ xem xét và phản hồi trong 24h. Vui lòng kiểm tra email hoặc thông báo.
        </p>
      </div>
    );
  }

  // ── Đã là affiliate: full dashboard ──────────────────────────────────────
  const displayName = dashboard?.profile?.full_name?.trim() || "Đối tác";

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
          Dashboard Đối tác — {displayName}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-medium text-primary">
            {TIER_LABEL[dashboard?.profile?.tier ?? "basic"] ?? dashboard?.profile?.tier}
          </span>
          <span className="text-sm text-neutral-600">
            Commission: {dashboard?.profile?.commission_rate ?? 40}%
          </span>
        </div>
      </div>

      {/* Section 1 — Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-600">Doanh thu tạo ra (tháng này)</p>
          <p className="mt-1 text-xl font-bold text-primary">
            {(dashboard?.stats.this_month_revenue ?? 0).toLocaleString("vi-VN")} đ
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-600">Commission kiếm được (tháng này)</p>
          <p className="mt-1 text-xl font-bold text-success">
            {(dashboard?.stats.this_month_commission ?? 0).toLocaleString("vi-VN")} đ
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-600">Số dư chờ thanh toán</p>
          <p className="mt-1 text-xl font-bold text-primary">
            {(dashboard?.stats.pending_balance ?? 0).toLocaleString("vi-VN")} đ
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-600">Đã thanh toán</p>
          <p className="mt-1 text-xl font-bold text-neutral-700">
            {(dashboard?.stats.paid_total ?? 0).toLocaleString("vi-VN")} đ
          </p>
        </div>
      </div>

      {/* Section 2 — Mã affiliate + Chia sẻ */}
      {dashboard?.code && (
        <section className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6">
          <h2 className="mb-4 font-heading font-semibold text-primary">Mã affiliate & Chia sẻ</h2>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-neutral-600">Mã</p>
              <p className="font-mono text-2xl font-bold text-primary">{dashboard.code.code}</p>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(dashboard.code!.code, "code")}
              className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-white px-4 py-2 font-medium text-primary"
            >
              <Copy className="h-4 w-4" /> {copied === "code" ? "Đã copy!" : "Copy mã"}
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-neutral-600">Link</p>
              <p className="break-all font-mono text-sm text-primary">{partnerLink}</p>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(partnerLink, "link")}
              className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-white px-4 py-2 font-medium text-primary"
            >
              <Copy className="h-4 w-4" /> {copied === "link" ? "Đã copy!" : "Copy link"}
            </button>
          </div>
          <div ref={qrRef} className="mt-4 flex justify-center">
            <QRCodeCanvas value={partnerLink} size={140} level="M" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`https://zalo.me/share?text=${encodeURIComponent(shareMessage)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-[#0068FF] px-4 py-2.5 text-sm font-medium text-white"
            >
              📱 Zalo
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(partnerLink)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-[#1877F2] px-4 py-2.5 text-sm font-medium text-white"
            >
              📘 Facebook
            </a>
            <button
              type="button"
              onClick={() => copyToClipboard(partnerLink, "link")}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium"
            >
              🔗 Copy link
            </button>
            <button
              type="button"
              onClick={downloadQR}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium"
            >
              📷 QR Code
            </button>
          </div>
        </section>
      )}

      {/* Section 3 — Monthly Chart */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-heading font-semibold text-primary">Biểu đồ theo tháng</h2>
          <select
            value={chartYear}
            onChange={(e) => setChartYear(parseInt(e.target.value, 10))}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dashboard?.monthly_chart ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => typeof v === 'number' ? v.toLocaleString("vi-VN") : v} />
              <Legend />
              <Bar dataKey="conversions" name="Đơn hàng" fill="#3b82f6" />
              <Bar dataKey="revenue" name="Doanh thu (đ)" fill="#22c55e" />
              <Bar dataKey="commission" name="Commission (đ)" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Section 4 — Recent Conversions */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 font-heading font-semibold text-primary">Đơn hàng gần đây</h2>
        {!dashboard?.recent_conversions?.length ? (
          <p className="py-8 text-center text-neutral-500">Chưa có đơn hàng</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left">
                  <th className="pb-2 font-medium">Ngày</th>
                  <th className="pb-2 font-medium">Người mua</th>
                  <th className="pb-2 font-medium">Chương trình</th>
                  <th className="pb-2 font-medium text-right">Doanh thu</th>
                  <th className="pb-2 font-medium text-right">Commission</th>
                  <th className="pb-2 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recent_conversions.map((row, i) => (
                  <tr key={i} className="border-b border-neutral-100 last:border-0">
                    <td className="py-3">{formatDate(row.date)}</td>
                    <td className="py-3">{row.referee_name}</td>
                    <td className="py-3">{row.program}</td>
                    <td className="py-3 text-right">{row.amount.toLocaleString("vi-VN")} đ</td>
                    <td className="py-3 text-right font-medium">{row.commission.toLocaleString("vi-VN")} đ</td>
                    <td className="py-3">
                      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        {row.status === "approved" ? "Approved" : row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 5 — Rút tiền */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 font-heading font-semibold text-primary">Rút tiền</h2>
        <p className="text-lg font-bold text-primary">
          Số dư: {(dashboard?.stats.pending_balance ?? 0).toLocaleString("vi-VN")} đ
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium">Thông tin ngân hàng</label>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <input
                type="text"
                placeholder="Ngân hàng"
                value={editBank.bank_name}
                onChange={(e) => setEditBank((p) => ({ ...p, bank_name: e.target.value }))}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Số tài khoản"
                value={editBank.bank_account_number}
                onChange={(e) => setEditBank((p) => ({ ...p, bank_account_number: e.target.value }))}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Tên chủ tài khoản"
                value={editBank.bank_account_name}
                onChange={(e) => setEditBank((p) => ({ ...p, bank_account_name: e.target.value }))}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleUpdateBank}
              className="mt-2 text-sm font-medium text-primary hover:underline"
            >
              Lưu thông tin
            </button>
          </div>

          <form onSubmit={handleWithdraw} className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium">Số tiền muốn rút (tối thiểu 200.000đ)</label>
              <input
                type="text"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value.replace(/\D/g, ""))}
                placeholder="200000"
                className="mt-1 w-40 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={withdrawSubmitting}
              className="rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {withdrawSubmitting ? "Đang xử lý..." : "Yêu cầu rút tiền"}
            </button>
          </form>
        </div>

        {withdrawError && <p className="mt-2 text-sm text-red-600">{withdrawError}</p>}
        {withdrawSuccess && <p className="mt-2 text-sm text-success">Yêu cầu rút tiền đã được ghi nhận.</p>}

        {dashboard?.withdrawal_history?.length ? (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-medium">Lịch sử rút tiền</h3>
            <ul className="space-y-2">
              {dashboard.withdrawal_history.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 text-sm"
                >
                  <span>{formatDate(w.created_at)}</span>
                  <span className="font-medium">-{w.amount.toLocaleString("vi-VN")} đ</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* Section 6 — Tài nguyên */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 font-heading font-semibold text-primary">Tài nguyên</h2>
        <ul className="space-y-3">
          <li>
            <a
              href="#"
              className="font-medium text-primary hover:underline"
            >
              📄 Tài liệu tiếp thị BodiX
            </a>
          </li>
          <li>
            <a
              href="#"
              className="font-medium text-primary hover:underline"
            >
              🖼️ Banner images, copy templates, FAQ
            </a>
          </li>
          <li>
            <a
              href="#"
              className="font-medium text-primary hover:underline"
            >
              📖 Hướng dẫn affiliate BodiX
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
