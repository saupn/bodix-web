"use client";

import { useEffect } from "react";
import Link from "next/link";

interface ProgramItem {
  slug: string;
  name: string;
  price_vnd: number;
  price_after: number;
  duration: string;
}

interface ReferralLandingClientProps {
  code: string;
  referrerName: string;
  discountPercent: number;
  programList: ProgramItem[];
}

function formatPrice(vnd: number): string {
  return new Intl.NumberFormat("vi-VN").format(vnd) + "đ";
}

export function ReferralLandingClient({
  code,
  referrerName,
  discountPercent,
  programList,
}: ReferralLandingClientProps) {
  useEffect(() => {
    fetch("/api/referral/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        event: "click",
        metadata: { source: "landing_page" },
      }),
    }).catch(() => {});
  }, [code]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:py-24">
      <div className="text-center">
        <h1 className="font-heading text-3xl font-bold text-primary sm:text-4xl">
          {referrerName} đã giới thiệu bạn đến BodiX!
        </h1>
        <p className="mt-4 text-lg text-neutral-600">
          Đăng ký ngay và nhận giảm {discountPercent}% chương trình đầu tiên
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {programList.map((prog) => (
          <div
            key={prog.slug}
            className="rounded-xl border-2 border-neutral-200 bg-white p-6 shadow-sm transition-shadow hover:border-primary/30 hover:shadow-md"
          >
            <h3 className="font-heading text-xl font-semibold text-primary">
              {prog.name}
            </h3>
            <p className="mt-1 text-sm text-accent font-medium">{prog.duration}</p>
            <div className="mt-4">
              <span className="text-sm text-neutral-500 line-through">
                {formatPrice(prog.price_vnd)}
              </span>
              <p className="mt-1 text-xl font-bold text-primary">
                {formatPrice(prog.price_after)}
              </p>
              <p className="text-xs text-success">
                Đã giảm {discountPercent}%
              </p>
            </div>
            <Link
              href={`/signup?ref=${code}`}
              className="mt-6 block w-full rounded-lg bg-primary py-3 text-center font-medium text-white transition-colors hover:bg-primary-dark"
            >
              Đăng ký ngay
            </Link>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-neutral-500">
        Đã có tài khoản?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
