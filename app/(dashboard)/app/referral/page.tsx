"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Info } from "lucide-react";
import { REFERRAL_COPY } from "@/lib/copy/referral";

const REFERRAL_BASE =
  typeof window !== "undefined"
    ? `${window.location.origin}/r`
    : process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/r`
      : "https://bodix.fit/r";

const STATUS_LABEL: Record<string, string> = REFERRAL_COPY.trackingStatusLabel;

const STATUS_CLASS: Record<string, string> = {
  clicked: "bg-neutral-200 text-neutral-600",
  signed_up: "bg-amber-100 text-amber-800",
  trial_started: "bg-amber-100 text-amber-800",
  converted: "bg-green-100 text-green-800",
  completed: "bg-amber-200 text-amber-900",
  expired: "bg-neutral-100 text-neutral-600",
  fraudulent: "bg-red-100 text-red-800",
};

const SOURCE_LABEL: Record<string, string> = REFERRAL_COPY.voucherSourceLabel;
const VOUCHER_STATUS_LABEL: Record<string, string> = REFERRAL_COPY.voucherStatusLabel;

const VOUCHER_STATUS_CLASS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  used: "bg-neutral-100 text-neutral-600",
  expired: "bg-neutral-100 text-neutral-600",
};

interface CodeData {
  code: string;
  referral_link: string;
}

interface TrackingData {
  stats: {
    total_clicks: number;
    total_signups: number;
    total_conversions: number;
    total_earned: number;
  };
  history: {
    id: string;
    display_name: string;
    status: string;
    date: string;
    reward: number | null;
  }[];
}

interface Voucher {
  id: string;
  code: string;
  amount: number;
  remaining_amount: number;
  status: string;
  expires_at: string;
  source_type: string;
  created_at: string;
  used_at: string | null;
}

interface VoucherData {
  vouchers: Voucher[];
  active_balance: number;
}

interface CommissionSummary {
  summary: {
    pending: number;
    successful: number;
    cancelled: number;
    cancelled_by_reason: Record<string, number>;
  };
}

const CANCEL_REASON_LABEL: Record<string, string> = {
  ...REFERRAL_COPY.cancelReasons,
  unknown: "Khác",
};

function formatDate(dateStr: string): string {
  if (!dateStr) return "–";
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ReferralPage() {
  const [codeData, setCodeData] = useState<CodeData | null>(null);
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [voucherData, setVoucherData] = useState<VoucherData | null>(null);
  const [commissionSummary, setCommissionSummary] =
    useState<CommissionSummary["summary"] | null>(null);
  const [isAffiliate, setIsAffiliate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const referralLink = codeData
    ? `${REFERRAL_BASE}/${codeData.code}`
    : "";

  useEffect(() => {
    const load = async () => {
      try {
        const [codeRes, trackRes, voucherRes, commissionRes, affiliateRes] = await Promise.all([
          fetch("/api/referral/code"),
          fetch("/api/referral/tracking"),
          fetch("/api/user/vouchers"),
          fetch("/api/referral/commissions-summary"),
          fetch("/api/affiliate/status"),
        ]);
        if (codeRes.ok) {
          const c = await codeRes.json();
          setCodeData({ code: c.code, referral_link: c.referral_link });
        }
        if (affiliateRes.ok) {
          const a = await affiliateRes.json();
          setIsAffiliate(!!a.is_approved);
        }
        if (trackRes.ok) {
          const t = await trackRes.json();
          setTrackingData(t);
        }
        if (voucherRes.ok) {
          const v = await voucherRes.json();
          setVoucherData(v);
        }
        if (commissionRes.ok) {
          const cs: CommissionSummary = await commissionRes.json();
          setCommissionSummary(cs.summary);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const copyToClipboard = async (text: string, key: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  };

  const shareZalo = () => {
    window.open(
      `https://zalo.me/share?url=${encodeURIComponent(referralLink)}&title=${encodeURIComponent(
        REFERRAL_COPY.zaloShareTitle
      )}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const shareFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`,
      "_blank",
      "noopener,noreferrer,width=600,height=400"
    );
  };

  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `bodix-referral-${codeData?.code ?? "qr"}.png`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-neutral-600">Đang tải...</p>
      </div>
    );
  }

  if (!codeData) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-neutral-200 bg-white p-6 text-center">
        <p className="text-neutral-600">Không thể tải mã giới thiệu.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-16">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
          {REFERRAL_COPY.shortTagline} 🎁
        </h1>
        <p className="mt-2 text-neutral-600">
          {REFERRAL_COPY.flowSteps[2].title}
        </p>
      </div>

      {/* Section 1 — Mã giới thiệu */}
      <section className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6 shadow-sm">
        <h2 className="mb-4 font-heading text-lg font-semibold text-primary">
          Mã giới thiệu của bạn
        </h2>
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-neutral-600">Mã</p>
              <p className="font-mono text-2xl font-bold text-primary sm:text-3xl">
                {codeData.code}
              </p>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(codeData.code, "code")}
              className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-white px-4 py-2 font-medium text-primary hover:bg-primary/5"
            >
              <Copy className="h-4 w-4" />
              {copied === "code" ? "Đã copy!" : "Copy mã"}
            </button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-neutral-600">Link</p>
              <p className="break-all font-mono text-sm text-primary">
                {referralLink}
              </p>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(referralLink, "link")}
              className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-white px-4 py-2 font-medium text-primary hover:bg-primary/5"
            >
              <Copy className="h-4 w-4" />
              {copied === "link" ? "Đã copy!" : "Copy link"}
            </button>
          </div>
          <div ref={qrRef} className="flex justify-center pt-4">
            <QRCodeCanvas value={referralLink} size={160} level="M" />
          </div>
        </div>

        {/* Share buttons */}
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={shareZalo}
            className="rounded-lg bg-[#0068FF] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0052cc]"
          >
            📱 Zalo
          </button>
          <button
            type="button"
            onClick={shareFacebook}
            className="rounded-lg bg-[#1877F2] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#166fe5]"
          >
            📘 Facebook
          </button>
          <button
            type="button"
            onClick={() => copyToClipboard(referralLink, "link")}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            🔗 Copy link
          </button>
          <button
            type="button"
            onClick={downloadQR}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            📷 QR Code
          </button>
        </div>
      </section>

      {/* Section 2 — Quy trình nhận thưởng */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="font-heading text-lg font-semibold text-primary">
          Quy trình nhận thưởng
        </h2>
        <ol className="mt-4 space-y-3 text-neutral-700">
          {REFERRAL_COPY.flowSteps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {i + 1}
              </span>
              <div>
                <p className="font-medium text-neutral-800">{step.title}</p>
                <p className="mt-0.5 text-sm text-neutral-600">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Section 3 — Thống kê */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 font-heading text-lg font-semibold text-primary">
          Thống kê
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-4 text-center">
            <p className="text-2xl font-bold text-primary">
              {trackingData?.stats.total_clicks ?? 0}
            </p>
            <p className="text-sm text-neutral-600">Lượt click</p>
          </div>
          <div className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-4 text-center">
            <p className="text-2xl font-bold text-primary">
              {trackingData?.stats.total_signups ?? 0}
            </p>
            <p className="text-sm text-neutral-600">Đã đăng ký</p>
          </div>
          <div className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-4 text-center">
            <p className="text-2xl font-bold text-primary">
              {trackingData?.stats.total_conversions ?? 0}
            </p>
            <p className="text-sm text-neutral-600">Đã mua</p>
          </div>
          <div className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-4 text-center">
            <p className="text-2xl font-bold text-success">
              {(trackingData?.stats.total_earned ?? 0).toLocaleString("vi-VN")} đ
            </p>
            <p className="text-sm text-neutral-600">Tổng voucher đã nhận</p>
          </div>
        </div>

        {/* Ghi chú phân biệt referral vs affiliate */}
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
          {isAffiliate ? (
            <p>
              <span className="font-medium text-neutral-600">Lưu ý:</span>{" "}
              {REFERRAL_COPY.affiliateSplitNote}{" "}
              <Link
                href="/app/affiliate"
                className="font-medium text-primary underline underline-offset-2 hover:text-primary-dark"
              >
                {REFERRAL_COPY.affiliateSplitNoteLink}
              </Link>
            </p>
          ) : (
            <p>
              <span className="font-medium text-neutral-600">Lưu ý:</span>{" "}
              {REFERRAL_COPY.referralOnlyNote}
            </p>
          )}
        </div>
      </section>

      {/* Section 3b — Tổng quan thưởng (theo commission status) */}
      {commissionSummary && (
        <section className="rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="mb-4 font-heading text-lg font-semibold text-primary">
            Tổng quan thưởng
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <p className="text-2xl font-bold text-amber-700">
                {commissionSummary.pending}
              </p>
              <p className="mt-1 text-sm text-neutral-700">{REFERRAL_COPY.commissionStatusLabel.pending}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {REFERRAL_COPY.pendingTooltip}
              </p>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50/50 p-4">
              <p className="text-2xl font-bold text-green-700">
                {commissionSummary.successful}
              </p>
              <p className="mt-1 text-sm text-neutral-700">{REFERRAL_COPY.commissionStatusLabel.successful}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {REFERRAL_COPY.successfulTooltip}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-4">
              <p className="text-2xl font-bold text-neutral-700">
                {commissionSummary.cancelled}
              </p>
              <p className="mt-1 text-sm text-neutral-700">{REFERRAL_COPY.commissionStatusLabel.cancelled}</p>
              {Object.entries(commissionSummary.cancelled_by_reason).length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs text-neutral-500">
                  {Object.entries(commissionSummary.cancelled_by_reason).map(
                    ([reason, count]) => (
                      <li key={reason}>
                        {CANCEL_REASON_LABEL[reason] ?? reason}: {count}
                      </li>
                    ),
                  )}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Section 4 — Lịch sử giới thiệu */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 font-heading text-lg font-semibold text-primary">
          Lịch sử giới thiệu
        </h2>
        {!trackingData?.history?.length ? (
          <p className="py-8 text-center text-neutral-600">
            Chưa có ai dùng link của bạn
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left">
                  <th className="pb-2 font-medium">Tên</th>
                  <th className="pb-2 font-medium">Trạng thái</th>
                  <th className="pb-2 font-medium">Ngày</th>
                  <th className="pb-2 font-medium text-right">Voucher</th>
                </tr>
              </thead>
              <tbody>
                {trackingData.history.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-neutral-100 last:border-0"
                  >
                    <td className="py-3">{row.display_name}</td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_CLASS[row.status] ?? "bg-neutral-100"
                        }`}
                      >
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                    </td>
                    <td className="py-3 text-neutral-600">
                      {formatDate(row.date)}
                    </td>
                    <td className="py-3 text-right font-medium">
                      {row.reward != null
                        ? `${row.reward.toLocaleString("vi-VN")} đ`
                        : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 5 — Voucher của bạn */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 font-heading text-lg font-semibold text-primary">
          Voucher của bạn
        </h2>
        <p className="text-2xl font-bold text-primary">
          {(voucherData?.active_balance ?? 0).toLocaleString("vi-VN")} đ
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          {REFERRAL_COPY.voucherListSubtitle}
        </p>

        {voucherData && voucherData.vouchers.length > 0 ? (
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-neutral-700">
              Danh sách voucher
            </h3>
            <ul className="space-y-2">
              {voucherData.vouchers.map((v) => {
                const expired = new Date(v.expires_at) <= new Date();
                const effectiveStatus = expired && v.status === "active" ? "expired" : v.status;
                const isActive = effectiveStatus === "active";
                return (
                  <li
                    key={v.id}
                    className={`rounded-lg border px-4 py-3 text-sm ${
                      isActive
                        ? "border-green-200 bg-green-50/50"
                        : "border-neutral-200 bg-neutral-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono font-semibold text-neutral-900">
                          {v.code}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-600">
                          {SOURCE_LABEL[v.source_type] ?? v.source_type} ·{" "}
                          {formatDate(v.created_at)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          VOUCHER_STATUS_CLASS[effectiveStatus] ?? "bg-neutral-100"
                        }`}
                      >
                        {VOUCHER_STATUS_LABEL[effectiveStatus] ?? effectiveStatus}
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between text-sm">
                      <span className="text-neutral-600">
                        {isActive
                          ? `Còn lại: ${v.remaining_amount.toLocaleString("vi-VN")} đ / ${v.amount.toLocaleString("vi-VN")} đ`
                          : `Mệnh giá: ${v.amount.toLocaleString("vi-VN")} đ`}
                      </span>
                      <span className="text-xs text-neutral-500">
                        HSD: {formatDate(v.expires_at)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-sm text-neutral-600">
            {REFERRAL_COPY.emptyVouchersMessage}
          </p>
        )}
      </section>

      {/* Section 6 — Điều kiện chi tiết */}
      <details className="rounded-xl border border-neutral-200 bg-white p-6">
        <summary className="cursor-pointer list-none font-heading font-semibold text-primary marker:hidden">
          <span className="inline-flex items-center gap-2">
            <span className="text-neutral-400">▸</span>
            Điều kiện chi tiết
          </span>
        </summary>
        <ul className="mt-4 space-y-2 text-sm text-neutral-700">
          {REFERRAL_COPY.conditions.map((c, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1 text-primary">•</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
