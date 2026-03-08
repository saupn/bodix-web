"use client";

import { useState, useCallback } from "react";
import { CheckoutForm } from "./CheckoutForm";

function formatPrice(vnd: number): string {
  return new Intl.NumberFormat("vi-VN").format(vnd) + "đ";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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
  const finalPrice = Math.max(0, program.price_vnd - referralDiscount);
  const handleReferralChange = useCallback((valid: boolean, discount: number) => {
    setReferralDiscount(valid ? discount : 0);
  }, []);

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
              <span>Giảm từ mã giới thiệu</span>
              <span className="font-medium">-{formatPrice(referralDiscount)}</span>
            </div>
          )}

          {cohort && (
            <>
              <div className="mt-3 text-sm">
                <p className="font-medium text-neutral-700">
                  {cohort.name} — Bắt đầu {formatDate(cohort.start_date)}
                </p>
                <p className="mt-1 text-accent">
                  Số chỗ còn lại:{" "}
                  {Math.max(0, cohort.max_members - (cohort.current_members ?? 0))}/
                  {cohort.max_members} chỗ
                </p>
              </div>
            </>
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

          <p className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
            <span>🔒</span> Thanh toán bảo mật
          </p>
        </div>
      </div>
    </div>
  );
}
