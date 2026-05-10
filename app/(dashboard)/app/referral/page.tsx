"use client";

import { useEffect, useState, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Copy } from "lucide-react";

const REFERRAL_BASE =
  typeof window !== "undefined"
    ? `${window.location.origin}/r`
    : process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/r`
      : "https://bodix.fit/r";

const STATUS_LABEL: Record<string, string> = {
  clicked: "Đã click",
  signed_up: "Đã đăng ký",
  trial_started: "Đã đăng ký",
  converted: "Đã mua",
  completed: "Completed",
  expired: "Hết hạn",
  fraudulent: "Gian lận",
};

const STATUS_CLASS: Record<string, string> = {
  clicked: "bg-neutral-200 text-neutral-600",
  signed_up: "bg-amber-100 text-amber-800",
  trial_started: "bg-amber-100 text-amber-800",
  converted: "bg-green-100 text-green-800",
  completed: "bg-amber-200 text-amber-900",
  expired: "bg-neutral-100 text-neutral-600",
  fraudulent: "bg-red-100 text-red-800",
};

const SOURCE_LABEL: Record<string, string> = {
  referral_reward: "Thưởng giới thiệu",
  admin_grant: "BodiX tặng",
  promotion: "Khuyến mãi",
};

const VOUCHER_STATUS_LABEL: Record<string, string> = {
  active: "Còn hiệu lực",
  used: "Đã dùng",
  expired: "Hết hạn",
};

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
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const referralLink = codeData
    ? `${REFERRAL_BASE}/${codeData.code}`
    : "";

  useEffect(() => {
    const load = async () => {
      try {
        const [codeRes, trackRes, voucherRes] = await Promise.all([
          fetch("/api/referral/code"),
          fetch("/api/referral/tracking"),
          fetch("/api/user/vouchers"),
        ]);
        if (codeRes.ok) {
          const c = await codeRes.json();
          setCodeData({ code: c.code, referral_link: c.referral_link });
        }
        if (trackRes.ok) {
          const t = await trackRes.json();
          setTrackingData(t);
        }
        if (voucherRes.ok) {
          const v = await voucherRes.json();
          setVoucherData(v);
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
        "Tập cùng mình trên BodiX – giảm 10% khi đăng ký!"
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
          Giới thiệu bạn bè – Nhận thưởng! 🎁
        </h1>
        <p className="mt-2 text-neutral-600">
          Mỗi bạn bè đăng ký qua link của bạn, bạn nhận voucher trị giá 100Kđ
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

      {/* Section 2 — Thưởng của bạn */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6 text-center">
        <h2 className="font-heading text-lg font-semibold text-primary">
          Thưởng của bạn
        </h2>
        <ul className="mt-4 space-y-2 text-left text-neutral-600 sm:mx-auto sm:max-w-md">
          <li>• Bạn bè đăng ký → Bạn nhận voucher 100Kđ</li>
          <li>• Bạn bè còn được giảm 10% chương trình đầu tiên</li>
          <li>• Voucher dùng để mua chương trình tiếp theo hoặc tặng bạn bè</li>
        </ul>
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
            <p className="text-sm text-neutral-600">Đã kiếm</p>
          </div>
        </div>
      </section>

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
                  <th className="pb-2 font-medium text-right">Reward</th>
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
          Tổng voucher còn hiệu lực – dùng tại bước thanh toán
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
            Chưa có voucher nào. Mời bạn bè để nhận voucher đầu tiên!
          </p>
        )}
      </section>
    </div>
  );
}
