"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, CheckCircle, Loader2, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  onVerified: () => void;
  onSkip: () => void;
}

type Stage = "input" | "waiting" | "success";

export default function PhoneVerify({ onVerified, onSkip }: Props) {
  const [stage, setStage] = useState<Stage>("input");

  // Stage 1: input
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Stage 2: waiting
  const [verifyCode, setVerifyCode] = useState("");
  const [zaloOaLink, setZaloOaLink] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Phone validation ──
  function validatePhone(value: string): string | null {
    if (!value) return null;
    if (!/^\d*$/.test(value)) return "Chỉ nhập số.";
    if (value.length > 0 && !value.startsWith("0")) return "SĐT phải bắt đầu bằng 0.";
    if (value.length > 10) return "SĐT tối đa 10 số.";
    if (value.length > 0 && value.length < 10) return "SĐT phải đủ 10 số.";
    return null;
  }

  function handlePhoneChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    setPhone(digits);
    setPhoneError(validatePhone(digits));
    setApiError(null);
  }

  const isPhoneValid = phone.length === 10 && phone.startsWith("0");

  // ── Request verify code ──
  async function handleSubmit() {
    if (!isPhoneValid || loading) return;
    setLoading(true);
    setApiError(null);

    try {
      const res = await fetch("/api/auth/request-phone-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();

      if (!res.ok) {
        setApiError(data.error || "Có lỗi xảy ra.");
        return;
      }

      setVerifyCode(data.verify_code);
      setZaloOaLink(data.zalo_oa_link);
      setSecondsLeft(data.expires_in);
      setShowResend(false);
      setStage("waiting");
    } catch {
      setApiError("Không thể kết nối. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  // ── Countdown timer ──
  useEffect(() => {
    if (stage !== "waiting") return;

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setShowResend(true);
          return 0;
        }
        // Show resend after 2 minutes
        if (prev <= (secondsLeft - 120)) setShowResend(true);
        return prev - 1;
      });
    }, 1000);

    // Show resend button after 2 minutes
    const resendTimeout = setTimeout(() => setShowResend(true), 120_000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      clearTimeout(resendTimeout);
    };
  }, [stage, secondsLeft]);

  // ── Polling for verification ──
  const checkVerified = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("phone_verified")
      .eq("id", user.id)
      .single();

    if (data?.phone_verified) {
      setStage("success");
    }
  }, []);

  useEffect(() => {
    if (stage !== "waiting") return;

    pollingRef.current = setInterval(checkVerified, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [stage, checkVerified]);

  // ── Success: auto-advance ──
  useEffect(() => {
    if (stage !== "success") return;
    const timeout = setTimeout(onVerified, 1500);
    return () => clearTimeout(timeout);
  }, [stage, onVerified]);

  // ── Copy to clipboard ──
  async function handleCopy() {
    await navigator.clipboard.writeText(verifyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Resend code ──
  async function handleResend() {
    setStage("input");
    setShowResend(false);
  }

  // ── Format timer ──
  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <AnimatePresence mode="wait">
        {/* ━━━ Stage 1: Phone input ━━━ */}
        {stage === "input" && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
          >
            <h2 className="text-2xl font-bold text-center mb-2">Kết nối Zalo</h2>
            <p className="text-center text-gray-500 mb-8">
              BodiX nhắc bạn tập luyện mỗi ngày qua Zalo
            </p>

            <div className="space-y-4">
              <div>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="Số điện thoại Zalo"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  className={`w-full px-4 py-3 rounded-lg border text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
                    phoneError && phone.length >= 3
                      ? "border-red-400 focus:ring-red-400"
                      : "border-gray-300 focus:ring-primary"
                  }`}
                />
                {phoneError && phone.length >= 3 && (
                  <p className="mt-1.5 text-sm text-red-500">{phoneError}</p>
                )}
              </div>

              {apiError && (
                <p className="text-sm text-red-500 text-center">{apiError}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={!isPhoneValid || loading}
                className="w-full px-6 py-3 rounded-lg font-medium text-base transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 min-h-[44px] bg-primary text-secondary-light hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  "Tiếp tục"
                )}
              </button>

              <button
                onClick={onSkip}
                className="w-full text-sm text-gray-600 hover:text-gray-600 transition-colors pt-2"
              >
                Bỏ qua →
              </button>
            </div>
          </motion.div>
        )}

        {/* ━━━ Stage 2: Waiting for verification ━━━ */}
        {stage === "waiting" && (
          <motion.div
            key="waiting"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
          >
            <h2 className="text-2xl font-bold text-center mb-2">Xác minh qua Zalo</h2>
            <p className="text-center text-gray-500 mb-6">
              Gửi mã bên dưới cho BodiX trên Zalo
            </p>

            {/* Verify code display */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="bg-gray-100 rounded-xl px-6 py-3">
                <span className="font-mono font-bold text-2xl tracking-widest select-all">
                  {verifyCode}
                </span>
              </div>
              <button
                onClick={handleCopy}
                className="p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                title="Copy mã"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <Copy className="w-5 h-5 text-gray-500" />
                )}
              </button>
            </div>

            {/* Steps */}
            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-secondary-light flex items-center justify-center text-sm font-bold">
                  1
                </span>
                <div className="flex-1 flex items-center gap-2 pt-0.5">
                  <span className="text-sm">Mở Zalo, tìm &quot;BodiX&quot;</span>
                  <button
                    onClick={() => window.open(zaloOaLink, "_blank")}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 transition-colors"
                  >
                    Mở Zalo <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-secondary-light flex items-center justify-center text-sm font-bold">
                  2
                </span>
                <span className="text-sm pt-0.5">Bấm &quot;Nhắn tin&quot;</span>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-secondary-light flex items-center justify-center text-sm font-bold">
                  3
                </span>
                <span className="text-sm pt-0.5">
                  Gửi tin nhắn: <span className="font-mono font-bold">{verifyCode}</span>
                </span>
              </div>
            </div>

            {/* Countdown */}
            <p className="text-center text-sm text-gray-600 mb-4">
              Mã hết hạn sau{" "}
              <span className="font-mono font-medium text-gray-600">
                {formatTime(secondsLeft)}
              </span>
            </p>

            {/* Resend / Skip */}
            <div className="flex flex-col items-center gap-2">
              {showResend && (
                <button
                  onClick={handleResend}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Gửi lại mã
                </button>
              )}
              <button
                onClick={onSkip}
                className="text-sm text-gray-600 hover:text-gray-600 transition-colors"
              >
                Bỏ qua →
              </button>
            </div>
          </motion.div>
        )}

        {/* ━━━ Stage 3: Success ━━━ */}
        {stage === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="flex flex-col items-center py-12"
          >
            <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold">Đã kết nối Zalo! ✅</h2>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
