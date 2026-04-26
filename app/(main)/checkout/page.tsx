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
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storageKey = `bodix_checkout_registered_${programSlug}`;

  useEffect(() => {
    setOrderCode(generateOrderCode());
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setOrderCode(saved);
        setRegistered(true);
      }
    } catch {
      /* ignore */
    }
  }, [storageKey]);

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

      setRegistered(true);
      try {
        localStorage.setItem(storageKey, orderCode);
      } catch {
        /* ignore */
      }
    } catch {
      setError("Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border-2 border-[#2D4A3E]/20 bg-white p-8 text-center">
        <h2 className="font-heading text-xl font-bold text-[#2D4A3E]">
          ✅ Đã đăng ký – Chờ xác nhận
        </h2>
        <p className="mt-4 text-neutral-600">
          Cảm ơn! Đăng ký của bạn đã được ghi nhận.
        </p>
        <p className="mt-2 text-sm text-neutral-600">
          Chúng tôi sẽ gửi thông báo qua Zalo khi bạn được tham gia.
        </p>
        <p className="mt-6 font-mono text-sm font-medium text-neutral-800">
          Mã đăng ký: {orderCode}
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

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-neutral-700">
        <p className="font-medium text-blue-900">ℹ️ Bạn chưa cần thanh toán ngay.</p>
        <p className="mt-2">
          Hiện có nhiều người đang đăng ký. Chúng tôi sẽ xác nhận và gửi thông báo cho bạn khi bạn
          được tham gia đợt tập tiếp theo.
        </p>
        <p className="mt-2">
          Vui lòng xác nhận đăng ký bên dưới để giữ chỗ.
        </p>
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
          {loading ? "Đang xử lý..." : "Xác nhận đăng ký"}
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
