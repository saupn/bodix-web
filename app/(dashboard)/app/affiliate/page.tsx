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
import { AFFILIATE_COPY } from "@/lib/copy/affiliate";
import { BankInfoForm } from "@/components/affiliate/BankInfoForm";

const REFERRAL_BASE = "https://bodix.fit";
const COMMISSION_RATE = AFFILIATE_COPY.commissionRate;
const MIN_WITHDRAWAL = AFFILIATE_COPY.minWithdrawVnd;
const WITHDRAWAL_ENABLED = AFFILIATE_COPY.withdrawalEnabled;
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
  commissions: CommissionRow[];
  commission_summary: {
    pending: number;
    payable: number;
    paid: number;
    cancelled_count: number;
    suspicious_count: number;
  };
}

interface CommissionRow {
  id: string;
  status: "pending" | "payable" | "paid" | "cancelled" | "suspicious";
  reward_amount_vnd: number;
  reward_rate: number | null;
  order_amount_vnd: number;
  purchase_at: string;
  payable_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  pending_expires_at: string;
  cancel_reason: string | null;
  referee_name: string;
  referee_name_masked: string;
}

const COMMISSION_STATUS_LABEL: Record<CommissionRow["status"], string> =
  AFFILIATE_COPY.statusLabel as Record<CommissionRow["status"], string>;

const COMMISSION_STATUS_CLASS: Record<CommissionRow["status"], string> = {
  pending: "bg-amber-100 text-amber-800",
  payable: "bg-emerald-100 text-emerald-800",
  paid: "bg-neutral-200 text-neutral-700",
  cancelled: "bg-red-100 text-red-700",
  suspicious: "bg-orange-100 text-orange-800",
};

function formatDate(dateStr: string): string {
  if (!dateStr) return "–";
  return formatDateVn(dateStr);
}

const TIPS = [
  "Chia sẻ câu chuyện thật của bạn – người thật, kết quả thật luôn thu hút hơn quảng cáo.",
  "Nhắm tới phụ nữ 25–42 tuổi, từng tập rồi bỏ – đối tượng dễ đồng cảm với BodiX nhất.",
  "Tặng sách miễn phí qua link tang-sach để khơi gợi thảo luận, dẫn dắt cuộc trò chuyện.",
  "Đăng 2–3 bài/tuần, đều đặn quan trọng hơn viral.",
  "Tận dụng Zalo – nhắn riêng cho từng bạn bè phù hợp, hiệu quả hơn đăng đại trà.",
  "Nhấn mạnh \"Thử miễn phí 3 ngày, không mất gì\" – rào cản thấp = nhiều click hơn.",
];

const PILL_CLASS_BY_LABEL: Record<string, string> = {
  "Đang chờ": "bg-amber-100 text-amber-800",
  "Có thể rút": "bg-emerald-100 text-emerald-800",
  "Đã rút": "bg-neutral-200 text-neutral-700",
};

function CommissionFlowSteps() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6">
      <h2 className="font-heading font-semibold text-primary">Quy trình nhận hoa hồng</h2>
      <ol className="mt-4 space-y-4">
        {AFFILIATE_COPY.flowSteps.map((step, i) => (
          <li key={i} className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {i + 1}
            </span>
            <div className="flex-1">
              <p className="font-medium text-neutral-800">{step.title}</p>
              <p className="mt-1 text-sm text-neutral-600">{step.body}</p>
              <span
                className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  PILL_CLASS_BY_LABEL[step.pillLabel] ?? "bg-primary/10 text-primary"
                }`}
              >
                {step.pillLabel}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CommissionTerms({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <details className="rounded-xl border border-neutral-200 bg-white p-6" open={defaultOpen}>
      <summary className="cursor-pointer list-none font-heading font-semibold text-primary marker:hidden">
        <span className="inline-flex items-center gap-2">
          <span className="text-neutral-400 transition-transform group-open:rotate-90">▸</span>
          Điều kiện chi tiết
        </span>
      </summary>
      <ul className="mt-4 space-y-2 text-sm text-neutral-700">
        {AFFILIATE_COPY.conditions.map((t, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1 text-primary">•</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function FaqSection() {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-6">
      <h2 className="mb-4 font-heading font-semibold text-primary">Câu hỏi thường gặp</h2>
      <div className="space-y-2">
        {AFFILIATE_COPY.faq.map((item, i) => (
          <details key={i} className="rounded-lg border border-neutral-100 px-4 py-3 open:bg-neutral-50">
            <summary className="cursor-pointer list-none text-sm font-medium text-neutral-800 marker:hidden">
              <span className="inline-flex items-center gap-2">
                <span className="text-neutral-400">▸</span>
                {item.q}
              </span>
            </summary>
            <p className="mt-2 pl-5 text-sm text-neutral-600">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

// Sort: pending (cần attention) → payable → paid → suspicious → cancelled.
const REFEREE_SORT_ORDER: Record<CommissionRow["status"], number> = {
  pending: 0,
  payable: 1,
  paid: 2,
  suspicious: 3,
  cancelled: 4,
};

const REFEREE_STATUS_LABEL = AFFILIATE_COPY.refereeStatusLabel as Record<
  CommissionRow["status"],
  string
>;

function refereeReferenceDate(c: CommissionRow): string {
  if (c.status === "payable" || c.status === "paid") return c.payable_at ?? c.purchase_at;
  if (c.status === "cancelled") return c.cancelled_at ?? c.purchase_at;
  return c.purchase_at;
}

function RefereeList({ commissions }: { commissions: CommissionRow[] }) {
  const sorted = [...commissions].sort(
    (a, b) => REFEREE_SORT_ORDER[a.status] - REFEREE_SORT_ORDER[b.status],
  );

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-6">
      <h2 className="font-heading font-semibold text-primary">Người được giới thiệu</h2>
      <p className="mt-1 text-sm text-neutral-600">{AFFILIATE_COPY.partnerMessage}</p>

      {sorted.length === 0 ? (
        <p className="mt-4 rounded-lg bg-neutral-50 p-4 text-sm text-neutral-600">
          {AFFILIATE_COPY.refereeEmptyState}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {sorted.map((c) => {
            const statusText =
              c.status === "cancelled" && c.cancel_reason
                ? c.cancel_reason
                : REFEREE_STATUS_LABEL[c.status] ?? c.status;
            return (
              <li
                key={c.id}
                className="flex flex-col gap-1 rounded-lg border border-neutral-100 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-neutral-800">{c.referee_name_masked}</p>
                  <p className="text-xs text-neutral-500">{formatDate(refereeReferenceDate(c))}</p>
                </div>
                <span
                  className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${COMMISSION_STATUS_CLASS[c.status]}`}
                >
                  {statusText}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function AffiliatePage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  // Registration form
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  const [chartYear, setChartYear] = useState(new Date().getFullYear());

  const affiliateCode = dashboard?.code?.code ?? "";
  const afLink = affiliateCode ? `${REFERRAL_BASE}/af/${affiliateCode}` : "";
  const refLink = affiliateCode ? `${REFERRAL_BASE}/r/${affiliateCode}` : "";

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
            }
          }
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [chartYear]);

  const copyToClipboard = async (text: string, key: string) => {
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
        {/* Lớp 1 – Tagline */}
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
            Trở thành Đối tác BodiX
          </h1>
          <p className="mt-3 text-base text-neutral-700 sm:text-lg">
            Nhận{" "}
            <span className="font-bold text-primary">{COMMISSION_RATE}%</span>{" "}
            hoa hồng tiền mặt khi bạn bè bắt đầu hành trình BodiX qua giới thiệu
            của bạn. Người bạn được giảm{" "}
            <span className="font-bold text-primary">10%</span> khi mua khoá đầu
            tiên.
          </p>
        </div>

        {/* Lớp 2 – 3 bước nhận hoa hồng */}
        <CommissionFlowSteps />

        {/* Lớp 3 – Điều kiện chi tiết */}
        <CommissionTerms />

        {/* Bảng hoa hồng */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="font-heading font-semibold text-primary mb-4">Bảng hoa hồng</h2>
          <p className="mb-4 text-xs text-neutral-600">
            Hoa hồng {COMMISSION_RATE}% tính trên số tiền người bạn đã thanh toán (sau khi
            áp giảm giá 10%).
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left">
                <th className="pb-2 font-medium">Chương trình</th>
                <th className="pb-2 font-medium text-right">Giá gốc</th>
                <th className="pb-2 font-medium text-right">Bạn bè trả</th>
                <th className="pb-2 font-medium text-right">Hoa hồng ({COMMISSION_RATE}%)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-neutral-100">
                <td className="py-2.5">BodiX 21</td>
                <td className="py-2.5 text-right">499.000đ</td>
                <td className="py-2.5 text-right">449.100đ</td>
                <td className="py-2.5 text-right font-semibold text-success">179.640đ</td>
              </tr>
              <tr className="border-b border-neutral-100">
                <td className="py-2.5">BodiX 6W</td>
                <td className="py-2.5 text-right">1.990.000đ</td>
                <td className="py-2.5 text-right">1.791.000đ</td>
                <td className="py-2.5 text-right font-semibold text-success">716.400đ</td>
              </tr>
              <tr>
                <td className="py-2.5">BodiX 12W</td>
                <td className="py-2.5 text-right">3.490.000đ</td>
                <td className="py-2.5 text-right">3.141.000đ</td>
                <td className="py-2.5 text-right font-semibold text-success">1.256.400đ</td>
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
          <p className="text-sm text-neutral-600">Có thể rút</p>
          <p className="mt-1 text-xl font-bold text-success">
            {(dashboard?.commission_summary?.payable ?? 0).toLocaleString("vi-VN")}đ
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-600">Đã rút</p>
          <p className="mt-1 text-xl font-bold text-neutral-700">
            {(dashboard?.commission_summary?.paid ?? 0).toLocaleString("vi-VN")}đ
          </p>
        </div>
      </div>

      {/* Mã + 2 link (dual-URL Cách 1.5) */}
      {dashboard?.code && (
        <section className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6">
          <h2 className="font-heading font-semibold text-primary">Link giới thiệu của bạn</h2>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-primary/20 bg-white px-4 py-2.5">
            <div>
              <p className="text-xs text-neutral-500">Mã của bạn</p>
              <p className="font-mono text-xl font-bold text-primary">{affiliateCode}</p>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(affiliateCode, "code")}
              className="inline-flex items-center gap-2 rounded-lg border border-primary/30 px-3 py-2 text-sm font-medium text-primary"
            >
              {copied === "code" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied === "code" ? "Đã copy!" : "Copy mã"}
            </button>
          </div>

          {/* Link Đối tác — /af/ */}
          <div className="mt-4 rounded-lg border border-primary/20 bg-white p-4">
            <p className="text-sm font-semibold text-primary">
              Đối tác chính thức ({COMMISSION_RATE}% hoa hồng tiền)
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="break-all font-mono text-sm text-neutral-700">{afLink}</p>
              <button
                type="button"
                onClick={() => copyToClipboard(afLink, "af")}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-primary/30 px-3 py-2 text-sm font-medium text-primary"
              >
                {copied === "af" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === "af" ? "Đã copy!" : "Copy"}
              </button>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Dùng khi giới thiệu cho audience của bạn (followers, KOL network).
            </p>
          </div>

          {/* Link Giới thiệu bạn bè — /r/ */}
          <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-4">
            <p className="text-sm font-semibold text-neutral-800">
              Giới thiệu bạn bè (voucher 100.000đ)
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="break-all font-mono text-sm text-neutral-700">{refLink}</p>
              <button
                type="button"
                onClick={() => copyToClipboard(refLink, "ref")}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700"
              >
                {copied === "ref" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === "ref" ? "Đã copy!" : "Copy"}
              </button>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Dùng khi giới thiệu cho người quen, gia đình, bạn bè.
            </p>
          </div>

          {/* QR + share cho link Đối tác */}
          <div ref={qrRef} className="mt-4 flex justify-center">
            <QRCodeCanvas value={afLink} size={140} level="M" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`https://zalo.me/share?url=${encodeURIComponent(afLink)}&title=${encodeURIComponent(
                "Tập cùng mình trên BodiX – giảm 10% khi đăng ký!"
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-[#0068FF] px-4 py-2.5 text-sm font-medium text-white"
            >
              Zalo
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(afLink)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-[#1877F2] px-4 py-2.5 text-sm font-medium text-white"
            >
              Facebook
            </a>
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

      {/* Commissions V2 (program_type='affiliate') */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="font-heading font-semibold text-primary">Hoa hồng</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Hoa hồng {dashboard?.profile?.commission_rate ?? COMMISSION_RATE}% được
            tạo khi người bạn giới thiệu thanh toán mua khoá, và chuyển sang{" "}
            <strong>Có thể rút</strong> khi họ vào cohort và check-in ngày đầu.
          </p>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Đang chờ</p>
            <p className="mt-1 text-lg font-bold text-amber-900">
              {(dashboard?.commission_summary?.pending ?? 0).toLocaleString("vi-VN")}đ
            </p>
            <p className="mt-1 text-xs text-amber-700">
              Chờ người bạn vào cohort và check-in ngày đầu
            </p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Có thể rút</p>
            <p className="mt-1 text-lg font-bold text-emerald-900">
              {(dashboard?.commission_summary?.payable ?? 0).toLocaleString("vi-VN")}đ
            </p>
            {(() => {
              const payable = dashboard?.commission_summary?.payable ?? 0;
              // Phân biệt 2 case: chưa đủ min withdraw vs đủ min nhưng tính năng chưa mở.
              const hint =
                payable < MIN_WITHDRAWAL
                  ? AFFILIATE_COPY.payableBelowMinHint(MIN_WITHDRAWAL - payable)
                  : AFFILIATE_COPY.payableAboveMinHint;
              return <p className="mt-1 text-xs text-emerald-700">{hint}</p>;
            })()}
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-700">Đã rút</p>
            <p className="mt-1 text-lg font-bold text-neutral-900">
              {(dashboard?.commission_summary?.paid ?? 0).toLocaleString("vi-VN")}đ
            </p>
          </div>
        </div>

        {!dashboard?.commissions?.length ? (
          <p className="py-8 text-center text-neutral-600">Chưa có hoa hồng nào</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left">
                  <th className="px-3 pb-2 font-medium first:pl-0 last:pr-0">Ngày mua</th>
                  <th className="px-3 pb-2 font-medium first:pl-0 last:pr-0">Người mua</th>
                  <th className="px-3 pb-2 font-medium text-right first:pl-0 last:pr-0">Doanh thu</th>
                  <th className="px-3 pb-2 font-medium text-right first:pl-0 last:pr-0">Hoa hồng</th>
                  <th className="px-3 pb-2 font-medium first:pl-0 last:pr-0">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.commissions.map((c) => (
                  <tr key={c.id} className="border-b border-neutral-100 last:border-0 align-top">
                    <td className="px-3 py-3 first:pl-0 last:pr-0 whitespace-nowrap">{formatDate(c.purchase_at)}</td>
                    <td className="px-3 py-3 first:pl-0 last:pr-0">{c.referee_name}</td>
                    <td className="px-3 py-3 text-right first:pl-0 last:pr-0 whitespace-nowrap">{c.order_amount_vnd.toLocaleString("vi-VN")}đ</td>
                    <td className="px-3 py-3 text-right font-medium text-success first:pl-0 last:pr-0 whitespace-nowrap">
                      {c.reward_amount_vnd.toLocaleString("vi-VN")}đ
                    </td>
                    <td className="px-3 py-3 first:pl-0 last:pr-0">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${COMMISSION_STATUS_CLASS[c.status]}`}>
                        {COMMISSION_STATUS_LABEL[c.status]}
                      </span>
                      {c.cancel_reason && (
                        <p className="mt-1 text-xs text-neutral-500">{c.cancel_reason}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Người được giới thiệu (referee list, masked) */}
      <RefereeList commissions={dashboard?.commissions ?? []} />

      {/* Recent Conversions (legacy referral_tracking view) */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 font-heading font-semibold text-primary">Lịch sử đơn hàng</h2>
        {!dashboard?.recent_conversions?.length ? (
          <p className="py-8 text-center text-neutral-600">Chưa có đơn hàng</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left">
                  <th className="px-3 pb-2 font-medium first:pl-0 last:pr-0">Ngày</th>
                  <th className="px-3 pb-2 font-medium first:pl-0 last:pr-0">Người mua</th>
                  <th className="px-3 pb-2 font-medium first:pl-0 last:pr-0">Chương trình</th>
                  <th className="px-3 pb-2 font-medium text-right first:pl-0 last:pr-0">Doanh thu</th>
                  <th className="px-3 pb-2 font-medium text-right first:pl-0 last:pr-0">Hoa hồng</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recent_conversions.map((row, i) => (
                  <tr key={i} className="border-b border-neutral-100 last:border-0">
                    <td className="px-3 py-3 first:pl-0 last:pr-0 whitespace-nowrap">{formatDate(row.date)}</td>
                    <td className="px-3 py-3 first:pl-0 last:pr-0">{row.referee_name}</td>
                    <td className="px-3 py-3 first:pl-0 last:pr-0">{row.program}</td>
                    <td className="px-3 py-3 text-right first:pl-0 last:pr-0 whitespace-nowrap">{row.amount.toLocaleString("vi-VN")}đ</td>
                    <td className="px-3 py-3 text-right font-medium text-success first:pl-0 last:pr-0 whitespace-nowrap">{row.commission.toLocaleString("vi-VN")}đ</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Rút tiền */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-2 font-heading font-semibold text-primary">Rút tiền</h2>
        <p className="text-sm text-neutral-600">
          Số dư có thể rút: <span className="font-bold text-primary">
            {(dashboard?.commission_summary?.payable ?? 0).toLocaleString("vi-VN")}đ
          </span>
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          Tối thiểu {MIN_WITHDRAWAL.toLocaleString("vi-VN")}đ cho mỗi lần rút.
        </p>

        <div className="mt-4 space-y-4">
          <BankInfoForm
            initial={dashboard?.bank_info}
            onSaved={(info) =>
              setDashboard((prev) => (prev ? { ...prev, bank_info: info } : prev))
            }
          />

          {WITHDRAWAL_ENABLED ? (
            <form onSubmit={handleWithdraw} className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-sm font-medium">
                  Số tiền (tối thiểu {MIN_WITHDRAWAL.toLocaleString("vi-VN")}đ)
                </label>
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
          ) : (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4">
              <button
                type="button"
                disabled
                title={AFFILIATE_COPY.withdrawDisabledTooltip}
                className="cursor-not-allowed rounded-lg bg-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-500"
              >
                Yêu cầu rút tiền
              </button>
              <p className="mt-2 text-sm text-neutral-600">
                {AFFILIATE_COPY.withdrawDisabledMessage}
              </p>
            </div>
          )}
        </div>

        {WITHDRAWAL_ENABLED && withdrawError && <p className="mt-2 text-sm text-red-600">{withdrawError}</p>}
        {WITHDRAWAL_ENABLED && withdrawSuccess && <p className="mt-2 text-sm text-success">Yêu cầu rút tiền đã được ghi nhận.</p>}

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

      {/* Điều kiện chi tiết */}
      <CommissionTerms />

      {/* FAQ */}
      <FaqSection />
    </div>
  );
}
