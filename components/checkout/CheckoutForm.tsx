"use client";

import { useState, useEffect } from "react";
import { Building2, Wallet, Ticket } from "lucide-react";
import { getSePayQRUrl } from "@/lib/sepay";
import { formatVnd } from "@/lib/checkout/calculate-total";
import {
  NO_REWARD,
  type ResolvedReward,
} from "@/lib/checkout/resolve-reward";

const REFERRAL_STORAGE_KEY = "bodix_referral_code";

type PaymentMethod = "bank_transfer" | "momo";

interface CheckoutFormProps {
  slug: string;
  programName: string;
  fullName: string;
  email: string;
  phone: string;
  priceVnd: number;
  referralReward: ResolvedReward;
  voucherReward: ResolvedReward;
  finalPrice: number;
  onReferralChange: (reward: ResolvedReward) => void;
  onVoucherChange: (reward: ResolvedReward) => void;
  onPaymentReady: (order: {
    orderId: string;
    paymentCode: string;
    amount: number;
    qrUrl: string;
  }) => void;
}

interface ValidateCodeResponse {
  valid: boolean;
  code_type: "referral" | "affiliate" | "voucher" | null;
  reward: ResolvedReward;
  reason?: string;
  error?: string;
}

interface VoucherLine {
  code: string;
  valid: boolean;
  amount: number;
  remaining: number;
  reason?: string;
}

export function CheckoutForm({
  slug,
  fullName,
  email,
  phone,
  priceVnd,
  referralReward,
  voucherReward,
  finalPrice,
  onReferralChange,
  onVoucherChange,
  onPaymentReady,
}: CheckoutFormProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank_transfer");
  const [referralCode, setReferralCode] = useState("");
  const [referralReason, setReferralReason] = useState<string | null>(null);
  const [referralValidating, setReferralValidating] = useState(false);

  const [voucherInput, setVoucherInput] = useState("");
  const [voucherLines, setVoucherLines] = useState<VoucherLine[]>([]);
  const [voucherValidating, setVoucherValidating] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cap voucher tổng: subtotal sau khi áp referral
  const referralDiscountAmount =
    referralReward.type === "percent"
      ? Math.round(priceVnd * (referralReward.value / 100))
      : referralReward.type === "fixed"
        ? Math.min(referralReward.value, priceVnd)
        : 0;
  const maxVoucherUsable = Math.max(0, priceVnd - referralDiscountAmount);

  useEffect(() => {
    try {
      const cookieMatch = document.cookie.match(/(?:^|;\s*)bodix_ref=([^;]*)/);
      const fromCookie = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
      const fromStorage = localStorage.getItem(REFERRAL_STORAGE_KEY);
      const code = fromCookie || fromStorage;
      if (code) setReferralCode(code);
    } catch {}
  }, []);

  // ── Referral validation via unified endpoint ─────────────────────────────
  useEffect(() => {
    if (!referralCode.trim()) {
      setReferralReason(null);
      onReferralChange(NO_REWARD);
      return;
    }
    const timer = setTimeout(async () => {
      setReferralValidating(true);
      try {
        const res = await fetch(
          `/api/checkout/validate-code?code=${encodeURIComponent(referralCode.trim())}`,
        );
        const data = (await res.json()) as ValidateCodeResponse;
        if (data.valid && data.reward.type !== "none") {
          setReferralReason(null);
          onReferralChange(data.reward);
        } else {
          setReferralReason(data.reason ?? "code_invalid");
          onReferralChange(NO_REWARD);
        }
      } catch {
        setReferralReason("network_error");
        onReferralChange(NO_REWARD);
      } finally {
        setReferralValidating(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [referralCode, onReferralChange]);

  // ── Voucher validation (multi-code, capped) ──────────────────────────────
  useEffect(() => {
    const codes = voucherInput
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    if (codes.length === 0) {
      setVoucherLines([]);
      onVoucherChange(NO_REWARD);
      return;
    }
    const timer = setTimeout(async () => {
      setVoucherValidating(true);
      try {
        let priceLeft = maxVoucherUsable;
        const lines: VoucherLine[] = [];
        for (const code of codes) {
          const res = await fetch(
            `/api/checkout/validate-code?code=${encodeURIComponent(code)}`,
          );
          const data = (await res.json()) as ValidateCodeResponse;
          if (
            data.valid &&
            data.code_type === "voucher" &&
            data.reward.type === "fixed" &&
            priceLeft > 0
          ) {
            const remaining = data.reward.value;
            const take = Math.min(remaining, priceLeft);
            priceLeft -= take;
            lines.push({ code, valid: true, amount: take, remaining });
          } else {
            lines.push({
              code,
              valid: false,
              amount: 0,
              remaining: data.reward.type === "fixed" ? data.reward.value : 0,
              reason: data.reason,
            });
          }
        }
        setVoucherLines(lines);
        const validOnly = lines.filter((l) => l.valid);
        const sum = validOnly.reduce((s, l) => s + l.amount, 0);
        if (sum > 0) {
          onVoucherChange({
            type: "fixed",
            value: sum,
            source: "db",
            label:
              validOnly.length === 1
                ? `Voucher ${validOnly[0].code}`
                : `Voucher (${validOnly.length} mã)`,
          });
        } else {
          onVoucherChange(NO_REWARD);
        }
      } catch {
        setVoucherLines([]);
        onVoucherChange(NO_REWARD);
      } finally {
        setVoucherValidating(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [voucherInput, maxVoucherUsable, onVoucherChange]);

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          payment_method: paymentMethod,
          referral_code:
            referralReward.type !== "none" ? referralCode.trim() : undefined,
          voucher_codes:
            voucherLines.filter((l) => l.valid).length > 0
              ? voucherLines.filter((l) => l.valid).map((l) => l.code)
              : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Có lỗi xảy ra. Vui lòng thử lại.");
        return;
      }

      if (!data.order_id || !data.payment_code) {
        setError("Không nhận được thông tin thanh toán. Vui lòng thử lại.");
        return;
      }

      const amount = data.pricing?.final_price ?? finalPrice;
      onPaymentReady({
        orderId: String(data.order_id),
        paymentCode: data.payment_code,
        amount,
        qrUrl: getSePayQRUrl(amount, data.payment_code, "compact"),
      });
    } catch {
      setError("Không thể kết nối. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const paymentOptions: {
    key: PaymentMethod;
    label: string;
    icon: React.ReactNode;
    active: boolean;
  }[] = [
    {
      key: "bank_transfer",
      label: "Chuyển khoản ngân hàng",
      icon: <Building2 className="h-5 w-5" />,
      active: true,
    },
    {
      key: "momo",
      label: "Ví MoMo",
      icon: <Wallet className="h-5 w-5" />,
      active: false,
    },
  ];

  const voucherCapHit =
    voucherReward.type === "fixed" && voucherReward.value >= maxVoucherUsable;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="font-heading text-lg font-semibold text-primary">
          Thông tin liên hệ
        </h2>
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-neutral-600">
              Họ tên
            </label>
            <input
              id="fullName"
              type="text"
              defaultValue={fullName}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-neutral-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              readOnly
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-600">
              Email
            </label>
            <input
              id="email"
              type="email"
              defaultValue={email}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-neutral-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              readOnly
            />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-neutral-600">
              Số điện thoại
            </label>
            <input
              id="phone"
              type="tel"
              defaultValue={phone}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-neutral-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              readOnly
            />
          </div>
        </div>
      </div>

      {/* Referral code */}
      <div>
        <label className="block text-sm font-medium text-neutral-600">
          Mã giới thiệu / đối tác
        </label>
        <input
          type="text"
          value={referralCode}
          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
          placeholder="VD: LAN, BODIX.PT (nếu có)"
          className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-neutral-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {referralValidating && (
          <p className="mt-1 text-xs text-neutral-500">Đang kiểm tra...</p>
        )}
        {!referralValidating && referralReward.type !== "none" && (
          <p className="mt-1 text-sm text-success">
            ✓ {referralReward.label} – Giảm {formatVnd(referralDiscountAmount)}
          </p>
        )}
        {!referralValidating && referralReason && referralCode.trim() && (
          <p className="mt-1 text-xs text-red-600">
            {referralReason === "self_referral"
              ? "Không thể dùng mã của chính bạn"
              : referralReason === "code_expired"
                ? "Mã đã hết hạn"
                : referralReason === "code_exhausted"
                  ? "Mã đã hết lượt sử dụng"
                  : referralReason === "code_inactive"
                    ? "Mã đã ngừng hoạt động"
                    : "Mã không hợp lệ"}
          </p>
        )}
      </div>

      {/* Voucher */}
      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium text-neutral-600">
          <Ticket className="h-4 w-4" />
          Voucher
        </label>
        <p className="mt-1 text-xs text-neutral-500">
          Tối đa {formatVnd(maxVoucherUsable)} voucher áp dụng cho đơn này.
        </p>
        <input
          type="text"
          value={voucherInput}
          onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
          placeholder="Nhập mã voucher (nhiều mã cách nhau bằng dấu phẩy)"
          className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-neutral-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="mt-1 text-xs text-neutral-500">
          Ví dụ: V-ABC123, V-DEF456
        </p>
        {voucherValidating && (
          <p className="mt-1 text-xs text-neutral-500">Đang kiểm tra...</p>
        )}
        {!voucherValidating && voucherLines.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {voucherLines.map((line) => (
              <li
                key={line.code}
                className={line.valid ? "text-success" : "text-red-600"}
              >
                {line.valid
                  ? `✅ ${line.code}: -${formatVnd(line.amount)}${
                      line.amount < line.remaining
                        ? ` (chỉ áp dụng đến mức cap; còn lại ${formatVnd(line.remaining - line.amount)} trong voucher)`
                        : ""
                    }`
                  : `❌ ${line.code}: không hợp lệ${
                      line.remaining > 0 && voucherCapHit
                        ? " hoặc đã đủ cap voucher cho đơn này"
                        : ""
                    }`}
              </li>
            ))}
            {voucherLines.some((l) => l.valid) && voucherReward.type === "fixed" && (
              <li className="font-medium text-neutral-800">
                Tổng giảm voucher: -{formatVnd(voucherReward.value)}
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Notice + Payment method */}
      <div>
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-medium">
            🎉 May mắn! Đợt tới còn chỗ – bạn có thể thanh toán giữ chỗ ngay bây giờ.
          </p>
          <p className="mt-2">
            Mỗi đợt giới hạn để đảm bảo chất lượng đồng hành.
          </p>
        </div>
        <h2 className="font-heading text-lg font-semibold text-primary">
          Phương thức thanh toán
        </h2>
        <div className="mt-3 space-y-2">
          {paymentOptions.map((opt) => (
            <label
              key={opt.key}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-4 transition-colors ${
                paymentMethod === opt.key
                  ? "border-primary bg-primary/5"
                  : opt.active
                  ? "border-neutral-200 hover:border-neutral-300"
                  : "cursor-not-allowed border-neutral-100 bg-neutral-50 opacity-60"
              }`}
            >
              <input
                type="radio"
                name="payment"
                value={opt.key}
                checked={paymentMethod === opt.key}
                onChange={() => opt.active && setPaymentMethod(opt.key)}
                disabled={!opt.active}
                className="h-4 w-4 text-primary"
              />
              <span className="text-neutral-600">{opt.icon}</span>
              <span className="flex-1 font-medium text-neutral-800">{opt.label}</span>
              {!opt.active && (
                <span className="text-xs text-neutral-400">(coming soon)</span>
              )}
            </label>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-accent/10 p-3 text-sm text-accent" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || paymentMethod !== "bank_transfer"}
        className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-secondary-light transition-colors hover:bg-primary-dark disabled:opacity-60"
      >
        {loading ? "Đang xử lý..." : `Thanh toán ngay – ${formatVnd(finalPrice)}`}
      </button>
    </form>
  );
}
