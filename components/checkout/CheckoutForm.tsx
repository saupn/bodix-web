"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
}: CheckoutFormProps) {
  const router = useRouter();
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

  // Voucher
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherValid, setVoucherValid] = useState<{
    valid: boolean;
    remaining_amount?: number;
  } | null>(null);
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

  // ── Voucher code validation ───────────────────────────────────────────────

  useEffect(() => {
    if (!voucherCode.trim()) {
      setVoucherValid(null);
      onVoucherChange?.(false, 0);
      return;
    }
    const timer = setTimeout(async () => {
      setVoucherValidating(true);
      try {
        const res = await fetch(`/api/voucher/validate?code=${encodeURIComponent(voucherCode.trim())}`);
        const data = await res.json();
        if (data.valid && data.remaining_amount > 0) {
          // Max voucher deduction = price after referral discount
          const referralDiscount = referralValid?.valid ? (referralValid.discount_amount ?? 0) : 0;
          const priceAfterReferral = priceVnd - referralDiscount;
          const voucherAmount = Math.min(data.remaining_amount, priceAfterReferral);
          setVoucherValid({ valid: true, remaining_amount: voucherAmount });
          onVoucherChange?.(true, voucherAmount);
        } else {
          setVoucherValid({ valid: false });
          onVoucherChange?.(false, 0);
        }
      } catch {
        setVoucherValid({ valid: false });
        onVoucherChange?.(false, 0);
      } finally {
        setVoucherValidating(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [voucherCode, priceVnd, referralValid, onVoucherChange]);

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
          voucher_code: voucherValid?.valid ? voucherCode.trim() : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Có lỗi xảy ra. Vui lòng thử lại.");
        return;
      }

      if (data.redirect) {
        router.push(data.redirect);
        router.refresh();
      }
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

      {/* Voucher code */}
      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium text-neutral-600">
          <Ticket className="h-4 w-4" />
          Voucher
        </label>
        <input
          type="text"
          value={voucherCode}
          onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
          placeholder="VD: V-ABC12 (nếu có)"
          className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-neutral-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {voucherValidating && (
          <p className="mt-1 text-xs text-neutral-500">Đang kiểm tra...</p>
        )}
        {!voucherValidating && voucherValid?.valid && (
          <p className="mt-1 text-sm text-success">
            ✓ Voucher hợp lệ — Giảm {voucherValid.remaining_amount?.toLocaleString("vi-VN")}đ
          </p>
        )}
        {!voucherValidating && voucherValid && !voucherValid.valid && voucherCode.trim() && (
          <p className="mt-1 text-xs text-red-600">Voucher không hợp lệ hoặc đã hết hạn</p>
        )}
      </div>

      {/* Payment method */}
      <div>
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
