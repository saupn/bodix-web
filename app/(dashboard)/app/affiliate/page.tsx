"use client";

import { useEffect, useState, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Check } from "lucide-react";
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
import { formatDateVn } from "@/lib/date/vietnam";

const REFERRAL_BASE = "https://bodix.fit";
const COMMISSION_RATE = 40;
const MIN_WITHDRAWAL = 200_000;
const TIER_LABEL: Record<string, string> = {
  basic: "Basic",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

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

function formatDate(dateStr: string): string {
  if (!dateStr) return "–";
  return formatDateVn(dateStr);
}

const TIPS = [
  "Chia sẻ câu chuyện thật của bạn – người thật, kết quả thật luôn thu hút hơn quảng cáo.",
  "Nhắm tới phụ nữ 25–42 tuổi, từng tập rồi bỏ – đối tượng dễ đồng cảm với BodiX nhất.",
  "Tặng sách miễn phí qua link tang-sach làm mồi để khởi đầu cuộc trò chuyện.",
  "Đăng 2–3 bài/tuần, đều đặn quan trọng hơn viral.",
  "Tận dụng Zalo – nhắn riêng cho từng bạn bè phù hợp, hiệu quả hơn đăng đại trà.",
  "Nhấn mạnh \"Thử miễn phí 3 ngày, không mất gì\" – rào cản thấp = nhiều click hơn.",
];

export default function AffiliatePage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  // Registration form
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [editBank, setEditBank] = useState({ bank_name: "", bank_account_number: "", bank_account_name: "" });
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  const [chartYear, setChartYear] = useState(new Date().getFullYear());

  const partnerLink = dashboard?.code
    ? `${REFERRAL_BASE}?ref=${dashboard.code.code}`
    : "";
  const shareMessage = dashboard?.code
    ? `Mình đang tập BodiX – chương trình fitness hoàn thành được! 💪\nDùng link của mình để giảm 10%.\n👉 ${partnerLink}`
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    setRegError(null);
    try {
      const res = await fetch("/api/affiliate/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank_name: bankName,
          bank_account_number: bankAccount,
          bank_account_name: bankHolder,
        }),
      });
      const data = await res.json();
      if (res.ok || data.status === "approved") {
        setStatus({ has_profile: true, is_approved: true });
        // Reload dashboard
        const dashRes = await fetch(`/api/affiliate/dashboard?year=${chartYear}`);
        if (dashRes.ok) setDashboard(await dashRes.json());
      } else {
        setRegError(data.error ?? "Có lỗi xảy ra.");
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleUpdateBank = async () => {
    const res = await fetch("/api/affiliate/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editBank),
    });
    if (res.ok && dashboard) {
      setDashboard({ ...dashboard, bank_info: { ...editBank } });
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
        <p className="text-neutral-600">Đang tải...</p>
      </div>
    );
  }

  // ── Chưa đăng ký: thông tin + form đăng ký inline ─────────────────────────
  if (!status?.has_profile || !status?.is_approved) {
    return (
      <div className="mx-auto max-w-2xl space-y-8 pb-16">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
            Trở thành Đối tác BodiX
          </h1>
          <p className="mt-2 text-neutral-700">
            Nhận{" "}
            <span className="font-bold text-primary">{COMMISSION_RATE}%</span>{" "}
            hoa hồng tiền mặt cho mỗi đơn hàng qua link của bạn. Người mua qua
            link đối tác được giảm{" "}
            <span className="font-bold text-primary">10%</span>.
          </p>
          <p className="mt-1 text-sm text-neutral-700">
            Thanh toán ngày 1 và 15 hàng tháng. Tối thiểu 200.000đ.
          </p>
        </div>

        {/* Bảng hoa hồng */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="font-heading font-semibold text-primary mb-4">Bảng hoa hồng</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left">
                <th className="pb-2 font-medium">Chương trình</th>
                <th className="pb-2 font-medium text-right">Giá</th>
                <th className="pb-2 font-medium text-right">Hoa hồng ({COMMISSION_RATE}%)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-neutral-100">
                <td className="py-2.5">BodiX 21</td>
                <td className="py-2.5 text-right">990.000đ</td>
                <td className="py-2.5 text-right font-semibold text-success">396.000đ</td>
              </tr>
              <tr className="border-b border-neutral-100">
                <td className="py-2.5">BodiX 6W</td>
                <td className="py-2.5 text-right">1.990.000đ</td>
                <td className="py-2.5 text-right font-semibold text-success">796.000đ</td>
              </tr>
              <tr>
                <td className="py-2.5">BodiX 12W</td>
                <td className="py-2.5 text-right">3.490.000đ</td>
                <td className="py-2.5 text-right font-semibold text-success">1.396.000đ</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Form đăng ký */}
        <form onSubmit={handleRegister} className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6 space-y-4">
          <h2 className="font-heading font-semibold text-primary">Thông tin nhận hoa hồng</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Tên ngân hàng</label>
              <input
                type="text"
                required
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="VD: Vietcombank"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Số tài khoản</label>
              <input
                type="text"
                required
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder="VD: 1234567890"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Tên chủ tài khoản</label>
              <input
                type="text"
                required
                value={bankHolder}
                onChange={(e) => setBankHolder(e.target.value)}
                placeholder="VD: NGUYEN VAN A"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
              />
            </div>
          </div>
          {regError && <p className="text-sm text-red-600">{regError}</p>}
          <button
            type="submit"
            disabled={registering}
            className="w-full rounded-xl bg-primary px-4 py-3.5 font-semibold text-secondary-light transition-colors hover:bg-primary-dark disabled:opacity-60"
          >
            {registering ? "Đang xử lý..." : "Trở thành Đối tác ngay"}
          </button>
        </form>
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
          Dashboard Đối tác – {displayName}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-medium text-primary">
            {TIER_LABEL[dashboard?.profile?.tier ?? "basic"]}
          </span>
          <span className="text-sm text-neutral-600">
            Hoa hồng: {dashboard?.profile?.commission_rate ?? COMMISSION_RATE}%
          </span>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-600">Doanh thu tháng này</p>
          <p className="mt-1 text-xl font-bold text-primary">
            {(dashboard?.stats.this_month_revenue ?? 0).toLocaleString("vi-VN")}đ
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-600">Hoa hồng tháng này</p>
          <p className="mt-1 text-xl font-bold text-success">
            {(dashboard?.stats.this_month_commission ?? 0).toLocaleString("vi-VN")}đ
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-600">Chờ thanh toán</p>
          <p className="mt-1 text-xl font-bold text-primary">
            {(dashboard?.stats.pending_balance ?? 0).toLocaleString("vi-VN")}đ
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-600">Đã thanh toán</p>
          <p className="mt-1 text-xl font-bold text-neutral-700">
            {(dashboard?.stats.paid_total ?? 0).toLocaleString("vi-VN")}đ
          </p>
        </div>
      </div>

      {/* Mã + Chia sẻ */}
      {dashboard?.code && (
        <section className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6">
          <h2 className="mb-4 font-heading font-semibold text-primary">Link giới thiệu</h2>
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
              {copied === "code" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied === "code" ? "Đã copy!" : "Copy mã"}
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
              {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied === "link" ? "Đã copy!" : "Copy link"}
            </button>
          </div>
          <div ref={qrRef} className="mt-4 flex justify-center">
            <QRCodeCanvas value={partnerLink} size={140} level="M" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`https://zalo.me/share?url=${encodeURIComponent(partnerLink)}&title=${encodeURIComponent(
                "Tập cùng mình trên BodiX – giảm 10% khi đăng ký!"
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-[#0068FF] px-4 py-2.5 text-sm font-medium text-white"
            >
              Zalo
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(partnerLink)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-[#1877F2] px-4 py-2.5 text-sm font-medium text-white"
            >
              Facebook
            </a>
            <button
              type="button"
              onClick={() => copyToClipboard(partnerLink, "link")}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium"
            >
              Copy link
            </button>
            <button
              type="button"
              onClick={downloadQR}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium"
            >
              QR Code
            </button>
          </div>
        </section>
      )}

      {/* Monthly Chart */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-heading font-semibold text-primary">Biểu đồ theo tháng</h2>
          <select
            value={chartYear}
            onChange={(e) => setChartYear(parseInt(e.target.value, 10))}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            {[new Date().getFullYear(), new Date().getFullYear() - 1].map((y) => (
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
              <Bar dataKey="conversions" name="Đơn" fill="#3b82f6" />
              <Bar dataKey="commission" name="Hoa hồng (đ)" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Recent Conversions */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 font-heading font-semibold text-primary">Lịch sử đơn hàng</h2>
        {!dashboard?.recent_conversions?.length ? (
          <p className="py-8 text-center text-neutral-600">Chưa có đơn hàng</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left">
                  <th className="pb-2 font-medium">Ngày</th>
                  <th className="pb-2 font-medium">Người mua</th>
                  <th className="pb-2 font-medium">Chương trình</th>
                  <th className="pb-2 font-medium text-right">Doanh thu</th>
                  <th className="pb-2 font-medium text-right">Hoa hồng</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recent_conversions.map((row, i) => (
                  <tr key={i} className="border-b border-neutral-100 last:border-0">
                    <td className="py-3">{formatDate(row.date)}</td>
                    <td className="py-3">{row.referee_name}</td>
                    <td className="py-3">{row.program}</td>
                    <td className="py-3 text-right">{row.amount.toLocaleString("vi-VN")}đ</td>
                    <td className="py-3 text-right font-medium text-success">{row.commission.toLocaleString("vi-VN")}đ</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Rút tiền */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 font-heading font-semibold text-primary">Rút tiền</h2>
        <p className="text-lg font-bold text-primary">
          Số dư: {(dashboard?.stats.pending_balance ?? 0).toLocaleString("vi-VN")}đ
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
              <label className="block text-sm font-medium">Số tiền (tối thiểu {MIN_WITHDRAWAL.toLocaleString("vi-VN")}đ)</label>
              <input
                type="text"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value.replace(/\D/g, ""))}
                placeholder={MIN_WITHDRAWAL.toLocaleString("vi-VN")}
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
                  <span className="font-medium">-{w.amount.toLocaleString("vi-VN")}đ</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* 6 Mẹo */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 font-heading font-semibold text-primary">6 mẹo tăng đơn hàng</h2>
        <ol className="space-y-3">
          {TIPS.map((tip, i) => (
            <li key={i} className="flex gap-3 text-sm text-neutral-700">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </span>
              {tip}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
