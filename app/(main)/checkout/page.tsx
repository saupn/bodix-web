"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  PROGRAMS,
  PAYMENT_INFO,
  formatPrice,
  type ProgramSlug,
} from "@/lib/config/pricing";
import { generateOrderCode } from "@/lib/payment/order";

const VALID_PROGRAMS: ProgramSlug[] = ["bodix21", "bodix6w", "bodix12w"];

function CheckoutContent() {
  const searchParams = useSearchParams();
  const programParam = searchParams.get("program") || "bodix21";
  const refParam = searchParams.get("ref") || "";

  const programSlug = VALID_PROGRAMS.includes(programParam as ProgramSlug)
    ? (programParam as ProgramSlug)
    : "bodix21";

  const program = PROGRAMS[programSlug];
  const [orderCode, setOrderCode] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"momo" | "bank">("momo");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOrderCode(generateOrderCode());
  }, []);

  const copyOrderCode = () => {
    if (orderCode) {
      navigator.clipboard.writeText(orderCode);
    }
  };

  const copyBankInfo = () => {
    const text = `Ngân hàng: ${PAYMENT_INFO.bank.bankName}
Số tài khoản: ${PAYMENT_INFO.bank.accountNumber}
Tên tài khoản: ${PAYMENT_INFO.bank.accountName}
Số tiền: ${formatPrice(program.price)}
Nội dung: ${orderCode}`;
    navigator.clipboard.writeText(text);
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payment/confirm-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_code: orderCode,
          program: programSlug,
          amount: program.price,
          payment_method: activeTab === "momo" ? "momo" : "bank_transfer",
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Đã xảy ra lỗi.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border-2 border-[#2D4A3E]/20 bg-white p-8 text-center">
        <div className="flex justify-center">
          <svg
            className="h-16 w-16 text-amber-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="mt-6 font-heading text-xl font-bold text-[#2D4A3E]">
          Cảm ơn! Đang xác nhận thanh toán.
        </h2>
        <p className="mt-3 text-neutral-600">
          Thường trong 5–15 phút (giờ hành chính)
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          Bạn sẽ nhận thông báo qua Zalo khi kích hoạt
        </p>
        <p className="mt-6 font-mono text-sm font-medium text-neutral-700">
          Mã đơn: {orderCode}
        </p>
        <Link
          href="/app"
          className="mt-8 block w-full rounded-xl bg-[#2D4A3E] py-4 text-center font-semibold text-white hover:bg-[#243d32]"
        >
          Quay về trang chủ
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/pricing"
          className="text-sm font-medium text-[#2D4A3E] hover:underline"
        >
          ← Đổi gói
        </Link>
      </div>

      <h1 className="font-heading text-2xl font-bold text-[#2D4A3E] sm:text-3xl">
        Đăng ký {program.name}
      </h1>

      {/* Tóm tắt gói */}
      <div className="rounded-2xl border-2 border-neutral-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-heading text-lg font-semibold text-[#2D4A3E]">
              {program.name}
            </h3>
            <p className="mt-1 text-neutral-600">{program.duration}</p>
            <p className="mt-2 text-2xl font-bold text-[#2D4A3E]">
              {formatPrice(program.price)}
            </p>
          </div>
          <Link
            href="/pricing"
            className="text-sm font-medium text-[#2D4A3E] hover:underline"
          >
            Đổi gói →
          </Link>
        </div>
        {refParam && (
          <p className="mt-4 text-sm text-neutral-500">
            Giới thiệu bởi: <span className="font-medium">{refParam}</span>
          </p>
        )}
      </div>

      {/* Tabs thanh toán */}
      <div>
        <div className="flex gap-2 border-b border-neutral-200">
          <button
            type="button"
            onClick={() => setActiveTab("momo")}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "momo"
                ? "border-[#2D4A3E] text-[#2D4A3E]"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            MoMo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bank")}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "bank"
                ? "border-[#2D4A3E] text-[#2D4A3E]"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            Chuyển khoản
          </button>
        </div>

        {activeTab === "momo" && (
          <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-6">
            <div className="flex justify-center">
              <Image
                src={program.momoQR}
                alt="QR MoMo"
                width={280}
                height={280}
                className="rounded-xl shadow-lg"
              />
            </div>
            <p className="mt-4 text-center text-sm text-neutral-600">
              Mở app MoMo → Quét mã → Thanh toán
            </p>
            <p className="mt-2 text-center font-medium text-neutral-800">
              Số tiền: {formatPrice(program.price)} (đã cài sẵn trong mã QR)
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="text-sm text-neutral-600">
                Nội dung chuyển:
              </span>
              <span className="font-mono font-bold">{orderCode}</span>
              <button
                type="button"
                onClick={copyOrderCode}
                className="rounded-lg border border-[#2D4A3E]/30 px-3 py-1.5 text-sm font-medium text-[#2D4A3E] hover:bg-[#2D4A3E]/5"
              >
                Copy mã đơn
              </button>
            </div>
          </div>
        )}

        {activeTab === "bank" && (
          <div className="mt-6 rounded-lg bg-gray-50 p-4">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-neutral-500">Ngân hàng</dt>
                <dd className="font-medium">{PAYMENT_INFO.bank.bankName}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Số tài khoản</dt>
                <dd className="font-mono font-bold">
                  {PAYMENT_INFO.bank.accountNumber}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Tên tài khoản</dt>
                <dd className="font-medium">{PAYMENT_INFO.bank.accountName}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Số tiền</dt>
                <dd className="font-bold text-[#2D4A3E]">
                  {formatPrice(program.price)}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Nội dung</dt>
                <dd className="font-mono font-bold">{orderCode}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={copyBankInfo}
              className="mt-4 w-full rounded-lg border border-neutral-300 bg-white py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Copy thông tin
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="sticky bottom-4 sm:static">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading || !orderCode}
          className="w-full rounded-xl bg-[#2D4A3E] py-4 font-semibold text-white hover:bg-[#243d32] disabled:opacity-50"
        >
          {loading ? "Đang xử lý..." : "Tôi đã thanh toán"}
        </button>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="py-8">Đang tải...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
