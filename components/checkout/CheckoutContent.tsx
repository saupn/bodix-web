"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { CheckoutForm } from "./CheckoutForm";
import { PaymentClient } from "./PaymentClient";
import { formatDateVn as formatDate } from "@/lib/date/vietnam";
import {
  calculateCheckoutTotal,
  formatVnd,
} from "@/lib/checkout/calculate-total";
import { NO_REWARD, type ResolvedReward } from "@/lib/checkout/resolve-reward";

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

type TrialState = "trial_active" | "trial_completed" | "no_trial";

interface CheckoutContentProps {
  slug: string;
  program: Program;
  cohort: Cohort | null;
  fullName: string;
  email: string;
  phone: string;
  initialPayment: InitialPayment | null;
  trialState: TrialState;
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
  trialState,
  bankConfig,
}: CheckoutContentProps) {
  const [referralReward, setReferralReward] = useState<ResolvedReward>(NO_REWARD);
  const [voucherReward, setVoucherReward] = useState<ResolvedReward>(NO_REWARD);
  const [activeOrder, setActiveOrder] = useState<InitialPayment | null>(initialPayment);
  const [paid, setPaid] = useState(false);

  const breakdown = useMemo(
    () =>
      calculateCheckoutTotal({
        basePriceVnd: program.price_vnd,
        referralReward: referralReward.type !== "none" ? referralReward : undefined,
        voucherReward: voucherReward.type !== "none" ? voucherReward : undefined,
      }),
    [program.price_vnd, referralReward, voucherReward],
  );

  const handleReferralChange = useCallback((reward: ResolvedReward) => {
    setReferralReward(reward);
  }, []);

  const handleVoucherChange = useCallback((reward: ResolvedReward) => {
    setVoucherReward(reward);
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
            referralReward={referralReward}
            voucherReward={voucherReward}
            finalPrice={breakdown.total}
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
                {formatVnd(breakdown.subtotal)}
              </span>
            </div>
            {breakdown.discounts.map((d, i) => (
              <div
                key={`${d.kind}-${i}`}
                className="flex items-baseline justify-between text-success"
              >
                <span>{d.label}</span>
                <span className="font-medium">-{formatVnd(d.amount)}</span>
              </div>
            ))}
          </div>

          {/* Cohort + trial info block — visible by default, not hidden */}
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-neutral-800">
            <p className="font-medium text-primary">Thông tin tập luyện</p>
            {cohort ? (
              <p className="mt-1.5">
                Cohort tập chính thức bắt đầu:{" "}
                <span className="font-semibold text-primary">
                  {formatDate(cohort.start_date)}
                </span>
                {cohort.name && ` (${cohort.name})`}.
              </p>
            ) : (
              <p className="mt-1.5 text-neutral-600">
                Đợt cohort sắp tới sẽ được thông báo qua Zalo trong 1–2 tuần.
              </p>
            )}
            {trialState === "trial_active" && (
              <p className="mt-1.5 text-neutral-700">
                Bạn đang trong giai đoạn tập thử. Sau khi thanh toán, bạn vẫn
                tiếp tục tập thử đủ 3 ngày như đã đăng ký – không bị rút ngắn.
              </p>
            )}
            {trialState === "no_trial" && (
              <p className="mt-1.5 text-neutral-700">
                Sau khi thanh toán, bạn có 3 ngày tập thử để làm quen với BodiX
                trước khi cohort chính thức bắt đầu.
              </p>
            )}
            {trialState === "trial_completed" && (
              <p className="mt-1.5 text-neutral-700">
                Trong thời gian chờ cohort start, bạn có thể xem lại tài liệu
                chuẩn bị – BodiX sẽ nhắc bạn trước ngày D1.
              </p>
            )}
          </div>

          <div className="my-4 border-t border-neutral-200" />

          <div className="flex items-baseline justify-between">
            <span className="font-medium text-neutral-700">Tổng thanh toán</span>
            <span className="text-2xl font-bold text-primary">
              {formatVnd(breakdown.total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
