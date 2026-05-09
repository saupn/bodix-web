"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface PaymentClientProps {
  orderId: string;
  paymentCode: string;
  amount: number;
  programName: string;
  qrUrl: string;
  bankAccount: string;
  bankCode: string;
  bankAccountName: string;
}

type Status = "pending" | "paid" | "expired";

function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
      aria-label={`Copy ${label ?? value}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Đã copy" : "Copy"}
    </button>
  );
}

export function PaymentClient({
  orderId,
  paymentCode,
  amount,
  programName,
  qrUrl,
  bankAccount,
  bankCode,
  bankAccountName,
}: PaymentClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("pending");

  useEffect(() => {
    if (status !== "pending") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/status`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.payment_status === "paid") {
          setStatus("paid");
          clearInterval(interval);
          setTimeout(() => {
            router.push(`/checkout/success?order=${orderId}`);
          }, 1500);
        }
      } catch {
        // network blip — keep polling
      }
    }, 3000);

    const timeout = setTimeout(
      () => {
        setStatus("expired");
        clearInterval(interval);
      },
      15 * 60 * 1000,
    );

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [status, orderId, router]);

  return (
    <div className="mx-auto max-w-md space-y-5 px-4 py-8">
      {/* Section 1: Tóm tắt đơn hàng */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h1 className="font-heading text-lg font-bold text-primary">
          Thanh toán {programName}
        </h1>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-sm text-neutral-600">Tổng thanh toán</span>
          <span className="text-2xl font-bold text-primary">{formatVnd(amount)}</span>
        </div>
      </div>

      {/* Section 2: QR code */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <p className="text-center text-sm font-medium text-neutral-700">
          Quét mã QR để thanh toán
        </p>
        <div className="mt-3 flex justify-center">
          <Image
            src={qrUrl}
            alt={`QR thanh toán ${paymentCode}`}
            width={320}
            height={420}
            unoptimized
            className="rounded-xl border border-neutral-100"
          />
        </div>
        <p className="mt-3 text-center text-xs text-neutral-500">
          Mã QR đã có sẵn số tiền và nội dung. Quét bằng app ngân hàng.
        </p>
      </div>

      {/* Section 3: Chuyển khoản thủ công */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-800">
          Hoặc chuyển khoản thủ công
        </h2>
        <dl className="mt-3 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-neutral-500">Ngân hàng</dt>
            <dd className="font-medium text-neutral-800">{bankCode}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-neutral-500">Số tài khoản</dt>
            <dd className="flex items-center gap-2">
              <span className="font-mono font-semibold text-neutral-800">{bankAccount}</span>
              <CopyButton value={bankAccount} label="số tài khoản" />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-neutral-500">Chủ tài khoản</dt>
            <dd className="font-medium text-neutral-800">{bankAccountName}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-neutral-500">Số tiền</dt>
            <dd className="flex items-center gap-2">
              <span className="font-mono font-semibold text-neutral-800">
                {amount.toLocaleString("vi-VN")}
              </span>
              <CopyButton value={String(amount)} label="số tiền" />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-neutral-500">Nội dung</dt>
            <dd className="flex items-center gap-2">
              <span className="rounded-md bg-red-50 px-2 py-0.5 font-mono text-base font-bold text-red-700">
                {paymentCode}
              </span>
              <CopyButton value={paymentCode} label="nội dung" />
            </dd>
          </div>
        </dl>
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠️ Vui lòng nhập đúng nội dung <span className="font-mono font-bold">{paymentCode}</span> để hệ thống tự xác nhận.
        </p>
      </div>

      {/* Section 4: Hướng dẫn */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold">Hướng dẫn</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Mở app ngân hàng → quét QR (hoặc chuyển khoản thủ công).</li>
          <li>
            Đảm bảo nội dung chuyển khoản:{" "}
            <span className="font-mono font-bold">{paymentCode}</span>
          </li>
          <li>Hệ thống tự động xác nhận sau 5–30 giây.</li>
          <li>
            <strong>KHÔNG đóng trang này</strong> — sẽ tự chuyển khi xong.
          </li>
        </ol>
      </div>

      {/* Section 5: Status */}
      <div
        className={`rounded-2xl border p-4 text-sm ${
          status === "pending"
            ? "border-neutral-200 bg-white"
            : status === "paid"
              ? "border-green-200 bg-green-50"
              : "border-red-200 bg-red-50"
        }`}
        role="status"
        aria-live="polite"
      >
        {status === "pending" && (
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="font-medium text-neutral-800">Đang chờ thanh toán...</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                Mình đang theo dõi giao dịch. Đừng đóng trang nhé!
              </p>
            </div>
          </div>
        )}
        {status === "paid" && (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-semibold text-green-900">Đã nhận thanh toán! 🎉</p>
              <p className="mt-0.5 text-xs text-green-800">Đang kích hoạt tài khoản...</p>
            </div>
          </div>
        )}
        {status === "expired" && (
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-semibold text-red-900">Hết thời gian chờ</p>
              <p className="mt-0.5 text-xs text-red-800">
                Tải lại trang nếu bạn đã chuyển khoản, hoặc liên hệ hỗ trợ.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-2 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
              >
                Tải lại
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
