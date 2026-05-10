"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { CheckoutForm } from "./CheckoutForm";
import { PaymentClient } from "./PaymentClient";
import { formatDateVn as formatDate } from "@/lib/date/vietnam";

function formatPrice(vnd: number): string {
  return new Intl.NumberFormat("vi-VN").format(vnd) + "đ";
}

interface Program {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_vnd: number;
  duration_days: number;
}

interface Cohort {
  id: string;
  name: string;
  start_date: string;
  max_members: number;
  current_members: number | null;
}

export interface InitialPayment {
  orderId: string;
  paymentCode: string;
  amount: number;
  qrUrl: string;
}

interface BankConfig {
  bankCode: string;
  bankAccount: string;
  bankAccountName: string;
}

interface CheckoutContentProps {
  slug: string;
  program: Program;
  cohort: Cohort | null;
  fullName: string;
  email: string;
  phone: string;
  initialPayment: InitialPayment | null;
  bankConfig: BankConfig;
}

export function CheckoutContent({
  slug,
  program,
  cohort,
  fullName,
  email,
  phone,
  initialPayment,
  bankConfig,
}: CheckoutContentProps) {
  const [referralDiscount, setReferralDiscount] = useState(0);
  const [referralCodeType, setReferralCodeType] = useState<string | null>(null);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [activeOrder, setActiveOrder] = useState<InitialPayment | null>(initialPayment);
  const [paid, setPaid] = useState(false);

  const totalDiscount = referralDiscount + voucherDiscount;
  const finalPrice = Math.max(0, program.price_vnd - totalDiscount);

  const handleReferralChange = useCallback(
    (
      valid: boolean,
      discount: number,
      codeType?: string,
      refName?: string,
    ) => {
      setReferralDiscount(valid ? discount : 0);
      setReferralCodeType(valid && codeType ? codeType : null);
      setReferrerName(valid && refName ? refName : null);
    },
    [],
  );

  const handleVoucherChange = useCallback((valid: boolean, discount: number) => {
    setVoucherDiscount(valid ? discount : 0);
  }, []);

  const handlePaymentReady = useCallback(
    (order: { orderId: string; paymentCode: string; amount: number; qrUrl: string }) => {
      setActiveOrder(order);
    },
    [],
  );

  const handlePaid = useCallback(() => {
    setPaid(true);
  }, []);

  const discountLabel = referralCodeType === "affiliate"
    ? referrerName
      ? `Giảm 10% từ đối tác ${referrerName}`
      : "Giảm 10% từ đối tác"
    : referrerName
      ? `Giảm 10% từ ${referrerName}`
      : "Giảm 10% từ mã giới thiệu";

  // ── Paid screen ────────────────────────────────────────────────────────────
  if (paid && activeOrder) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-green-200 bg-green-50 p-8 text-center shadow-sm">
        <div className="mb-4 text-5xl">✅</div>
        <h2 className="font-heading text-2xl font-bold text-green-900">
          Thanh toán thành công!
        </h2>
        <p className="mt-3 text-green-800">
          Tài khoản đã được kích hoạt cho {program.name}.
        </p>
        <p className="mt-2 text-sm text-green-700">
          Bạn sẽ nhận thông báo khi đợt tập tiếp theo mở.
        </p>
        <Link
          href="/app"
          className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-white hover:bg-primary-dark"
        >
          Về Dashboard
        </Link>
      </div>
    );
  }

  // ── Inline QR view (after submit, or resume from server) ───────────────────
  if (activeOrder) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-medium">Đơn hàng đang chờ thanh toán</p>
          <p className="mt-1">
            Mã thanh toán: <span className="font-mono font-bold">{activeOrder.paymentCode}</span>
            . Quét QR hoặc chuyển khoản theo thông tin dưới đây – hệ thống tự xác nhận sau 5–30 giây.
          </p>
        </div>
        <PaymentClient
          orderId={activeOrder.orderId}
          paymentCode={activeOrder.paymentCode}
          amount={activeOrder.amount}
          programName={program.name}
          qrUrl={activeOrder.qrUrl}
          bankAccount={bankConfig.bankAccount}
          bankCode={bankConfig.bankCode}
          bankAccountName={bankConfig.bankAccountName}
          onPaid={handlePaid}
        />
      </div>
    );
  }

  // ── Form view ──────────────────────────────────────────────────────────────
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
          Đăng ký {program.name}
        </h1>
        <div className="mt-6">
          <CheckoutForm
            slug={slug}
            programName={program.name}
            fullName={fullName}
            email={email}
            phone={phone}
            priceVnd={program.price_vnd}
            referralDiscount={referralDiscount}
            voucherDiscount={voucherDiscount}
            finalPrice={finalPrice}
            onReferralChange={handleReferralChange}
            onVoucherChange={handleVoucherChange}
            onPaymentReady={handlePaymentReady}
          />
        </div>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-lg font-semibold text-primary">
            Tóm tắt đơn hàng
          </h2>

          <div className="mt-4 rounded-lg border border-neutral-100 bg-neutral-50/50 p-4">
            <h3 className="font-heading font-semibold text-primary">
              {program.name}
            </h3>
            <p className="mt-1 text-sm text-accent font-medium">
              {program.duration_days === 21
                ? "21 ngày"
                : program.duration_days === 42
                  ? "6 tuần"
                  : program.duration_days === 84
                    ? "12 tuần"
                    : `${program.duration_days} ngày`}
            </p>
            {program.description && (
              <p className="mt-2 line-clamp-2 text-sm text-neutral-600">
                {program.description}
              </p>
            )}
          </div>

          {/* Breakdown */}
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-neutral-600">Giá gốc</span>
              <span className="font-medium text-neutral-800">
                {formatPrice(program.price_vnd)}
              </span>
            </div>
            {referralDiscount > 0 && (
              <div className="flex items-baseline justify-between text-success">
                <span>{discountLabel}</span>
                <span className="font-medium">-{formatPrice(referralDiscount)}</span>
              </div>
            )}
            {voucherDiscount > 0 && (
              <div className="flex items-baseline justify-between text-success">
                <span>Voucher dùng</span>
                <span className="font-medium">-{formatPrice(voucherDiscount)}</span>
              </div>
            )}
          </div>

          {cohort && (
            <div className="mt-3 text-sm">
              <p className="font-medium text-neutral-700">
                {cohort.name} – Bắt đầu {formatDate(cohort.start_date)}
              </p>
            </div>
          )}

          {!cohort && (
            <p className="mt-3 text-sm text-neutral-500">
              Đợt sắp tới sẽ được cập nhật
            </p>
          )}

          <div className="my-4 border-t border-neutral-200" />

          <div className="flex items-baseline justify-between">
            <span className="font-medium text-neutral-700">Tổng thanh toán</span>
            <span className="text-2xl font-bold text-primary">
              {formatPrice(finalPrice)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
