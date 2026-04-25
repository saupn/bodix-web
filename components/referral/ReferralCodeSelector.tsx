"use client";

import { useState, useEffect, useCallback } from "react";
import {
  suggestReferralCodes,
  sanitizeReferralCodeInput,
  isValidReferralCode,
} from "@/lib/referral/utils";
import { useToast } from "@/components/ui/Toast";

interface Props {
  fullName: string;
  onCodeSet?: (code: string) => void;
  onSkip?: () => void;
  /** Đã có mã từ trước (edit mode) */
  initialCode?: string | null;
  /** Bật khi parent đang chạy handleComplete — disable Tiếp tục, show spinner */
  submittingComplete?: boolean;
}

export function ReferralCodeSelector({
  fullName,
  onCodeSet,
  onSkip,
  initialCode,
  submittingComplete = false,
}: Props) {
  const { info: toastInfo } = useToast();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [customCode, setCustomCode] = useState(initialCode ?? "");
  const [selectedCode, setSelectedCode] = useState<string | null>(
    initialCode ?? null
  );
  const [availability, setAvailability] = useState<"idle" | "checking" | "ok" | "taken">("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPromoModal, setShowPromoModal] = useState(false);

  // Gợi ý từ tên
  useEffect(() => {
    setSuggestions(suggestReferralCodes(fullName));
  }, [fullName]);

  // Check availability khi custom code thay đổi
  const checkAvailability = useCallback(async (code: string) => {
    if (!code || !isValidReferralCode(code)) {
      setAvailability("idle");
      return;
    }
    setAvailability("checking");
    try {
      const res = await fetch(`/api/referral/check?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      setAvailability(data.available ? "ok" : "taken");
    } catch {
      setAvailability("idle");
    }
  }, []);

  useEffect(() => {
    if (!customCode.trim()) {
      setAvailability("idle");
      return;
    }
    const normalized = sanitizeReferralCodeInput(customCode);
    if (normalized.length < 3) {
      setAvailability("idle");
      return;
    }
    const t = setTimeout(() => checkAvailability(normalized), 300);
    return () => clearTimeout(t);
  }, [customCode, checkAvailability]);

  const handleSelectSuggestion = (code: string) => {
    setCustomCode(code);
    setAvailability("checking");
    checkAvailability(code);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    const sanitized = sanitizeReferralCodeInput(v);
    setCustomCode(sanitized);
    setSelectedCode(null);
  };

  const handleSubmit = async () => {
    const code = customCode.trim().toUpperCase();
    if (!code || !isValidReferralCode(code)) {
      setError("Mã phải từ 3–15 ký tự, A-Z, 0-9, dấu chấm.");
      return;
    }
    if (availability === "taken" && code !== initialCode) {
      setError("Mã này đã được sử dụng.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/referral/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Không thể lưu mã.");
        setLoading(false);
        return;
      }

      setSelectedCode(code);
    } catch {
      setError("Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    onSkip?.();
  };

  const displayCode = selectedCode || customCode.trim().toUpperCase();
  const canCopy = displayCode && isValidReferralCode(displayCode);
  const showResult = selectedCode && !error;

  const shareMessage = displayCode
    ? `Mình đang tập với BodiX — chương trình 21 ngày thay đổi thật sự. Bạn được giảm 10% khi đăng ký qua link này: https://bodix.fit?ref=${displayCode}. Tập thử 3 ngày miễn phí!`
    : "";

  const shareZaloUrl = displayCode
    ? `https://zalo.me/share?url=${encodeURIComponent(
        `https://bodix.fit?ref=${displayCode}`
      )}&title=${encodeURIComponent(shareMessage)}`
    : "";

  const handleShareZalo = async () => {
    if (!shareZaloUrl || !shareMessage) return;

    try {
      const popup = window.open(shareZaloUrl, "_blank");
      if (!popup) {
        throw new Error("Unable to open Zalo share window");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(shareMessage);
      } catch {}
      toastInfo("Đã copy tin nhắn! Mở Zalo và gửi cho bạn bè nha 🎉");
      window.open("https://zalo.me", "_blank");
    }
  };

  return (
    <div className="space-y-6">
      {showPromoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="promo-modal-title"
        >
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setShowPromoModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
              aria-label="Đóng"
            >
              ✕
            </button>
            <h2 id="promo-modal-title" className="pr-8 text-xl font-bold text-gray-900">
              Chương trình ưu đãi BodiX
            </h2>
            <div className="mt-4 space-y-4 text-sm text-neutral-700">
              <div>
                <p className="font-semibold text-neutral-900">🎁 Giới thiệu bạn bè</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Mỗi bạn bè đăng ký qua link → bạn nhận voucher 100.000đ</li>
                  <li>Bạn bè được giảm 10% khi đăng ký</li>
                  <li>Voucher dùng cho BodiX hoặc tặng tiếp cho người khác</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-neutral-900">💰 Chương trình Cộng tác viên</p>
                <p className="mt-1 text-neutral-600">(Dành cho người muốn kiếm thu nhập từ BodiX)</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Hoa hồng 40% tiền mặt cho mỗi đơn đăng ký</li>
                  <li>Đăng ký 1 click trong Dashboard sau khi đăng nhập</li>
                  <li>Theo dõi thu nhập realtime</li>
                  <li>
                    Chi tiết tại:{" "}
                    <a
                      href="https://bodix.fit/affiliate"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      bodix.fit/affiliate
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPromoModal(false)}
              className="mt-6 w-full rounded-lg bg-primary py-3 font-semibold text-white hover:bg-primary-dark"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}

      <div>
        <h2 className="font-heading text-xl font-bold text-primary sm:text-2xl">
          Mời bạn bè tập cùng — nhận quà từ BodiX!
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Khi bạn bè đăng ký qua link của bạn, cả hai đều nhận ưu đãi. Chọn mã riêng theo tên bạn để bắt đầu.
        </p>
        <button
          type="button"
          onClick={() => setShowPromoModal(true)}
          className="mt-2 cursor-pointer text-sm font-medium text-[#2D4A3E] hover:text-[#1f352d]"
        >
          ℹ️ Tìm hiểu chương trình ưu đãi →
        </button>
      </div>

      {!showResult && suggestions.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-neutral-700">
            Gợi ý từ tên của bạn
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSelectSuggestion(s)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  selectedCode === s || customCode === s
                    ? "bg-primary text-white"
                    : "border-2 border-neutral-300 bg-white text-neutral-700 hover:border-primary/50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {!showResult && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">
            Hoặc nhập mã của bạn
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customCode}
              onChange={handleCustomChange}
              placeholder="VD: LAN, NGUYENLAN"
              maxLength={15}
              className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-3 font-mono text-neutral-800 placeholder-neutral-400 uppercase transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {availability === "checking" && (
              <span className="flex items-center text-sm text-neutral-500">
                Đang kiểm tra...
              </span>
            )}
            {availability === "ok" && (
              <span className="flex items-center text-sm text-green-600">
                ✅ Mã khả dụng
              </span>
            )}
            {availability === "taken" && (
              <span className="flex items-center text-sm text-red-600">
                Mã đã được dùng
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            3–15 ký tự, A-Z, 0-9, dấu chấm. Tự động viết hoa.
          </p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {showResult && (
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-medium text-primary">Tin nhắn giới thiệu của bạn</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{shareMessage}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(shareMessage);
              }}
              disabled={!canCopy}
              className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              Copy tin nhắn
            </button>
            <button
              type="button"
              onClick={handleShareZalo}
              disabled={!shareZaloUrl}
              className="rounded-lg bg-[#0068FF] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Chia sẻ Zalo
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        {onSkip && (
          <button
            type="button"
            onClick={handleSkip}
            className="flex-1 rounded-lg border-2 border-neutral-300 px-4 py-3 font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Bỏ qua
          </button>
        )}
        {showResult ? (
          <button
            type="button"
            onClick={() => {
              console.log('[onboarding] Tiếp tục clicked, selectedCode:', selectedCode);
              onCodeSet?.(selectedCode!);
            }}
            disabled={submittingComplete}
            className="flex-1 rounded-lg bg-primary px-4 py-3 font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {submittingComplete ? "Đang hoàn tất..." : "Tiếp tục"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              loading ||
              !customCode.trim() ||
              !isValidReferralCode(customCode.trim()) ||
              availability === "taken"
            }
            className="flex-1 rounded-lg bg-primary px-4 py-3 font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? "Đang lưu..." : "Lưu mã"}
          </button>
        )}
      </div>
    </div>
  );
}
