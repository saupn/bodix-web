"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReferralCodeSelector } from "@/components/referral/ReferralCodeSelector";
import { useToast } from "@/components/ui/Toast";

interface GiftBookContentProps {
  fullName: string | null;
  referralCode: string | null;
  remaining: number;
  total: number;
  baseUrl: string;
}

export function GiftBookContent({
  fullName,
  referralCode,
  remaining,
  total,
  baseUrl,
}: GiftBookContentProps) {
  const router = useRouter();
  const { success: toastSuccess } = useToast();
  const [referralModalOpen, setReferralModalOpen] = useState(false);

  // Trạng thái: chưa có code, hết suất, hoặc còn suất
  const kind: "need_code" | "exhausted" | "active" = !referralCode
    ? "need_code"
    : remaining <= 0
      ? "exhausted"
      : "active";

  const giftLink = referralCode
    ? `${baseUrl.replace(/\/$/, "")}/tang-sach?from=${referralCode}`
    : null;

  const pct = Math.min(100, Math.round((remaining / Math.max(1, total)) * 100));

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="rounded-lg bg-neutral-50 p-3">
        <p className="mb-2 text-sm text-neutral-700">📖 Đọc sách trước khi tặng:</p>
        <a
          href="/api/guides/download"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-[#2D4A3E] hover:underline"
        >
          Tải &quot;Tại sao nhịn ăn không giúp bạn gọn hơn&quot; →
        </a>
      </div>

      {kind === "need_code" && (
        <div className="mt-6">
          <p className="text-sm text-neutral-700">
            Bạn chưa có mã giới thiệu. Tạo mã để bắt đầu tặng sách cho bạn bè.
          </p>
          <button
            type="button"
            onClick={() => setReferralModalOpen(true)}
            className="mt-3 rounded-xl bg-[#2D4A3E] px-4 py-3 text-sm font-semibold text-white hover:bg-[#243d32]"
          >
            Tạo mã giới thiệu
          </button>
        </div>
      )}

      {kind === "exhausted" && (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-neutral-800">
            🎉 Bạn đã tặng hết {total} suất! Cảm ơn bạn đã chia sẻ.
          </p>
          <p className="text-sm text-neutral-600">
            Muốn thêm suất? Nhắn cho BodiX qua Zalo OA để được hỗ trợ.
          </p>
        </div>
      )}

      {kind === "active" && referralCode && giftLink && (
        <div className="mt-6 space-y-4">
          <p className="text-neutral-800">
            Còn lại:{" "}
            <span className="text-2xl font-bold text-[#2D4A3E]">
              {remaining}/{total}
            </span>{" "}
            suất
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-[#2D4A3E]/40 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <p className="text-xs font-medium text-neutral-600">Mã của bạn</p>
            <p className="mt-1 font-mono text-lg font-bold tracking-wider text-[#2D4A3E]">
              {referralCode}
            </p>
            <p className="mt-3 text-xs font-medium text-neutral-600">Link tặng</p>
            <p className="mt-1 break-all font-mono text-sm text-neutral-900">
              {giftLink.replace(/^https?:\/\//, "")}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(giftLink);
                toastSuccess("Đã copy!");
              }}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-[#2D4A3E]/30 bg-white px-4 py-3 text-sm font-medium text-[#2D4A3E] hover:bg-[#2D4A3E]/5 min-h-[44px]"
            >
              📋 Copy link
            </button>
            <button
              type="button"
              onClick={() =>
                window.open(
                  `https://zalo.me/share?url=${encodeURIComponent(giftLink)}&title=${encodeURIComponent(
                    "Tặng bạn Cẩm nang Khởi động BodiX – miễn phí!",
                  )}`,
                  "_blank",
                  "noopener,noreferrer",
                )
              }
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#0068FF] px-4 py-3 text-sm font-medium text-white hover:bg-[#0052cc] min-h-[44px]"
            >
              💬 Chia sẻ Zalo
            </button>
            <button
              type="button"
              onClick={() =>
                window.open(
                  `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(giftLink)}`,
                  "_blank",
                  "noopener,noreferrer",
                )
              }
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-[#1877F2] bg-[#1877F2] px-4 py-3 text-sm font-medium text-white hover:bg-[#166fe5] min-h-[44px]"
            >
              📘 Chia sẻ Facebook
            </button>
          </div>
        </div>
      )}

      {referralModalOpen && kind === "need_code" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="referral-gift-modal-title"
        >
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setReferralModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-neutral-600 hover:bg-neutral-100"
              aria-label="Đóng"
            >
              ✕
            </button>
            <h2 id="referral-gift-modal-title" className="sr-only">
              Tạo mã giới thiệu
            </h2>
            <div className="mt-1">
              <ReferralCodeSelector
                fullName={fullName ?? ""}
                onCodeSet={() => {
                  setReferralModalOpen(false);
                  router.refresh();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
