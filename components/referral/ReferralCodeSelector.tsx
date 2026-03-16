"use client";

import { useState, useEffect, useCallback } from "react";
import {
  suggestReferralCodes,
  sanitizeReferralCodeInput,
  isValidReferralCode,
} from "@/lib/referral/utils";
import { REFERRAL_BASE } from "@/lib/constants";

interface Props {
  fullName: string;
  onCodeSet?: (code: string) => void;
  onSkip?: () => void;
  /** Đã có mã từ trước (edit mode) */
  initialCode?: string | null;
}

export function ReferralCodeSelector({
  fullName,
  onCodeSet,
  onSkip,
  initialCode,
}: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [customCode, setCustomCode] = useState(initialCode ?? "");
  const [selectedCode, setSelectedCode] = useState<string | null>(
    initialCode ?? null
  );
  const [availability, setAvailability] = useState<"idle" | "checking" | "ok" | "taken">("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setSelectedCode(code);
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
      onCodeSet?.(code);
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
  const referralLink = displayCode ? `${REFERRAL_BASE}/r/${displayCode}` : "";
  const canCopy = displayCode && isValidReferralCode(displayCode);
  const showResult = selectedCode && !error;

  const shareZaloText = displayCode
    ? `Mình đang tập BodiX - app fitness tại nhà, rất hiệu quả! Bạn thử nhé: ${referralLink}`
    : "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold text-primary sm:text-2xl">
          Tạo mã giới thiệu của riêng bạn
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Chia sẻ mã này để mời bạn bè tập cùng BodiX
        </p>
      </div>

      {suggestions.length > 0 && (
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
          <p className="text-sm font-medium text-primary">Link giới thiệu của bạn</p>
          <p className="mt-1 font-mono text-sm break-all">{referralLink}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(referralLink);
              }}
              className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
            >
              Copy link
            </button>
            <a
              href={`https://zalo.me/share/inline?u=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareZaloText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-[#0068FF] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Chia sẻ Zalo
            </a>
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
            onClick={() => onCodeSet?.(selectedCode!)}
            className="flex-1 rounded-lg bg-primary px-4 py-3 font-semibold text-white hover:bg-primary-dark"
          >
            Tiếp tục
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
