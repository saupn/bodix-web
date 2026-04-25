"use client";

import { useState, useEffect } from "react";
import { Building2, Wallet, Ticket } from "lucide-react";

const REFERRAL_STORAGE_KEY = "bodix_referral_code";

type PaymentMethod = "bank_transfer" | "momo";

interface CheckoutFormProps {
  slug: string;
  programName: string;
  fullName: string;
  email: string;
  phone: string;
  priceVnd: number;
  onReferralChange?: (valid: boolean, discount: number, codeType?: string, referrerName?: string) => void;
  onVoucherChange?: (valid: boolean, discount: number) => void;
  onSubmitted?: () => void;
}

export function CheckoutForm({
  slug,
  programName,
  fullName,
  email,
  phone,
  priceVnd,
  onReferralChange,
  onVoucherChange,
  onSubmitted,
}: CheckoutFormProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank_transfer");
  const [referralCode, setReferralCode] = useState("");
  const [referralValid, setReferralValid] = useState<{
    valid: boolean;
    referrer_name?: string;
    code_type?: string;
    discount_percent?: number;
    discount_amount?: number;
  } | null>(null);
  const [referralValidating, setReferralValidating] = useState(false);

  // Voucher — nhiều mã, phân tách bằng dấu phẩy
  const [voucherInput, setVoucherInput] = useState("");
  const [voucherLines, setVoucherLines] = useState<
    { code: string; valid: boolean; amount: number }[]
  >([]);
  const [voucherValidating, setVoucherValidating] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Read from cookie first, then localStorage fallback
    try {
      const cookieMatch = document.cookie.match(/(?:^|;\s*)bodix_ref=([^;]*)/);
      const fromCookie = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
      const fromStorage = localStorage.getItem(REFERRAL_STORAGE_KEY);
      const code = fromCookie || fromStorage;
      if (code) setReferralCode(code);
    } catch {}
  }, []);

  // ── Referral code validation ──────────────────────────────────────────────

  useEffect(() => {
    if (!referralCode.trim()) {
      setReferralValid(null);
      onReferralChange?.(false, 0);
      return;
    }
    const timer = setTimeout(async () => {
      setReferralValidating(true);
      try {
        const res = await fetch(`/api/referral/validate?code=${encodeURIComponent(referralCode.trim())}`);
        const data = await res.json();
        if (data.valid && data.referee_reward_type === "discount_percent" && data.referee_reward_value) {
          const pct = data.referee_reward_value;
          const discountAmount = Math.round(priceVnd * (pct / 100));
          setReferralValid({
            valid: true,
            referrer_name: data.referrer_name,
            code_type: data.code_type,
            discount_percent: pct,
            discount_amount: discountAmount,
          });
          onReferralChange?.(true, discountAmount, data.code_type, data.referrer_name);
        } else if (data.valid && data.referee_reward_type === "discount_fixed" && data.referee_reward_value) {
          const discountAmount = Math.min(data.referee_reward_value, priceVnd);
          setReferralValid({
            valid: true,
            referrer_name: data.referrer_name,
            code_type: data.code_type,
            discount_amount: discountAmount,
          });
          onReferralChange?.(true, discountAmount, data.code_type, data.referrer_name);
        } else if (data.valid) {
          setReferralValid({ valid: true, referrer_name: data.referrer_name, code_type: data.code_type, discount_amount: 0 });
          onReferralChange?.(false, 0);
        } else {
          setReferralValid({ valid: false });
          onReferralChange?.(false, 0);
        }
      } catch {
        setReferralValid({ valid: false });
        onReferralChange?.(false, 0);
      } finally {
        setReferralValidating(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [referralCode, priceVnd, onReferralChange]);

  // ── Voucher: từng mã sau dấu phẩy, cộng dồn giảm ───────────────────────────

  useEffect(() => {
    const codes = voucherInput
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    if (codes.length === 0) {
      setVoucherLines([]);
      onVoucherChange?.(false, 0);
      return;
    }
    const timer = setTimeout(async () => {
      setVoucherValidating(true);
      try {
        const referralDiscount = referralValid?.valid
          ? (referralValid.discount_amount ?? 0)
          : 0;
        let priceLeft = priceVnd - referralDiscount;
        const lines: { code: string; valid: boolean; amount: number }[] = [];
        let total = 0;
        for (const code of codes) {
          const res = await fetch(
            `/api/voucher/validate?code=${encodeURIComponent(code)}`
          );
          const data = (await res.json()) as {
            valid?: boolean;
            remaining_amount?: number;
          };
          if (data.valid && (data.remaining_amount ?? 0) > 0 && priceLeft > 0) {
            const take = Math.min(data.remaining_amount ?? 0, priceLeft);
            total += take;
            priceLeft -= take;
            lines.push({ code, valid: true, amount: take });
          } else {
            lines.push({ code, valid: false, amount: 0 });
          }
        }
        setVoucherLines(lines);
        const validOnly = lines.filter((l) => l.valid);
        const sum = validOnly.reduce((s, l) => s + l.amount, 0);
        onVoucherChange?.(validOnly.length > 0 && sum > 0, sum);
      } catch {
        setVoucherLines([]);
        onVoucherChange?.(false, 0);
      } finally {
        setVoucherValidating(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [voucherInput, priceVnd, referralValid, onVoucherChange]);

  // ── Submit ────────────────────────────────────────────────────────────────

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
          referral_code: referralValid?.valid ? referralCode.trim() : undefined,
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

      onSubmitted?.();
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

  // ── Referral discount label ───────────────────────────────────────────────

  const referralLabel = referralValid?.valid
    ? referralValid.code_type === "affiliate"
      ? `Giảm ${referralValid.discount_percent ?? 10}% từ đối tác ${referralValid.referrer_name}`
      : `Giảm ${referralValid.discount_percent ?? 10}% từ mã giới thiệu ${referralValid.referrer_name}`
    : null;

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
        {!referralValidating && referralValid?.valid && referralLabel && (
          <p className="mt-1 text-sm text-success">
            ✓ {referralLabel} — Giảm {referralValid.discount_amount?.toLocaleString("vi-VN")}đ
          </p>
        )}
        {!referralValidating && referralValid && !referralValid.valid && referralCode.trim() && (
          <p className="mt-1 text-xs text-red-600">Mã không hợp lệ</p>
        )}
      </div>

      {/* Voucher — nhiều mã */}
      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium text-neutral-600">
          <Ticket className="h-4 w-4" />
          Voucher
        </label>
        <input
          type="text"
          value={voucherInput}
          onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
          placeholder="Nhập mã voucher (nhiều mã cách nhau bằng dấu phẩy)"
          className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-neutral-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
                  ? `✅ ${line.code}: -${line.amount.toLocaleString("vi-VN")}đ`
                  : `❌ ${line.code}: không hợp lệ`}
              </li>
            ))}
            {voucherLines.some((l) => l.valid) && (
              <li className="font-medium text-neutral-800">
                Tổng giảm voucher: -
                {voucherLines
                  .filter((l) => l.valid)
                  .reduce((s, l) => s + l.amount, 0)
                  .toLocaleString("vi-VN")}
                đ
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Payment method */}
      <div>
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-neutral-700">
          <p className="font-medium text-blue-900">ℹ️ Bạn chưa cần thanh toán ngay.</p>
          <p className="mt-2">
            Hiện có nhiều người đang đăng ký. Chúng tôi sẽ xác nhận và gửi thông báo cho bạn khi bạn
            được tham gia đợt tập tiếp theo.
          </p>
          <p className="mt-2">
            Vui lòng xác nhận đăng ký bên dưới để giữ chỗ.
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
        {loading ? "Đang xử lý..." : "Xác nhận đăng ký"}
      </button>
    </form>
  );
}
