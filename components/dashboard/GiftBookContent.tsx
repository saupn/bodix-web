"use client";

import { useToast } from "@/components/ui/Toast";
import { REFERRAL_COPY } from "@/lib/copy/referral";

interface GiftBookContentProps {
  fullName: string | null;
  referralCode: string | null;
  remaining: number;
  total: number;
  baseUrl: string;
}

export function GiftBookContent({
  referralCode,
  remaining,
  total,
  baseUrl,
}: GiftBookContentProps) {
  const { success: toastSuccess } = useToast();

  // Mọi user đều có sẵn referralCode (auto-create lúc onboarding). Nếu
  // referralCode null ở đây là edge case race condition → hiển thị
  // fallback hướng dẫn reload, không cần form tạo code.
  const kind: "missing_code" | "exhausted" | "active" = !referralCode
    ? "missing_code"
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

      {kind === "missing_code" && (
        <div className="mt-6">
          <p className="text-sm text-neutral-700">
            {REFERRAL_COPY.giftBookNoCodeFallback}
          </p>
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

    </div>
  );
}
