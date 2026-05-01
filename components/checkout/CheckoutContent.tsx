"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { CheckoutForm } from "./CheckoutForm";
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

interface CheckoutContentProps {
  slug: string;
  program: Program;
  cohort: Cohort | null;
  fullName: string;
  email: string;
  phone: string;
}

export function CheckoutContent({
  slug,
  program,
  cohort,
  fullName,
  email,
  phone,
}: CheckoutContentProps) {
  const [referralDiscount, setReferralDiscount] = useState(0);
  const [referralCodeType, setReferralCodeType] = useState<string | null>(null);
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const totalDiscount = referralDiscount + voucherDiscount;
  const finalPrice = Math.max(0, program.price_vnd - totalDiscount);

  const handleReferralChange = useCallback((valid: boolean, discount: number, codeType?: string) => {
    setReferralDiscount(valid ? discount : 0);
    setReferralCodeType(valid && codeType ? codeType : null);
  }, []);

  const handleVoucherChange = useCallback((valid: boolean, discount: number) => {
    setVoucherDiscount(valid ? discount : 0);
  }, []);

  const handleSubmitted = useCallback(() => {
    setSubmitted(true);
  }, []);

  const discountLabel = referralCodeType === "affiliate"
    ? "Giảm từ đối tác"
    : "Giảm từ mã giới thiệu";

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-4 text-4xl">✅</div>
        <h2 className="font-heading text-xl font-bold text-primary sm:text-2xl">
          Đăng ký thành công!
        </h2>
        <p className="mt-3 text-neutral-600">
          Chờ thông báo nếu bạn được chọn tham gia nhé!
        </p>
        <Link
          href="/app"
          className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
        >
          ← Về trang chủ
        </Link>
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
            onReferralChange={handleReferralChange}
            onVoucherChange={handleVoucherChange}
            onSubmitted={handleSubmitted}
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

          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-neutral-600">Giá</span>
            <span className="font-semibold text-primary">
              {formatPrice(program.price_vnd)}
            </span>
          </div>

          {referralDiscount > 0 && (
            <div className="mt-3 flex items-baseline justify-between text-success">
              <span>{discountLabel}</span>
              <span className="font-medium">-{formatPrice(referralDiscount)}</span>
            </div>
          )}

          {voucherDiscount > 0 && (
            <div className="mt-3 flex items-baseline justify-between text-success">
              <span>Voucher</span>
              <span className="font-medium">-{formatPrice(voucherDiscount)}</span>
            </div>
          )}

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
            <span className="text-xl font-bold text-primary">
              {formatPrice(finalPrice)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
