"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PROGRAMS } from "@/lib/constants";

const GOALS = [
  "Giảm mỡ",
  "Săn chắc cơ thể",
  "Tăng sức bền",
  "Cải thiện vóc dáng",
  "Tạo thói quen tập luyện",
] as const;

const GENDERS = [
  { value: "female", label: "Nữ" },
  { value: "male", label: "Nam" },
  { value: "other", label: "Khác" },
] as const;

function isValidVietnamPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return (
    (digits.length === 10 && digits.startsWith("0") && /^0[35789]/.test(digits)) ||
    (digits.length === 9 && /^[35789]/.test(digits))
  );
}

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction < 0 ? 300 : -300, opacity: 0 }),
};

interface Props {
  userId: string;
  initialName: string;
}

export default function OnboardingForm({ userId, initialName }: Props) {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [fullName, setFullName] = useState(initialName);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<"female" | "male" | "other">("female");

  // Step 2
  const [goals, setGoals] = useState<string[]>([]);

  // Step 3
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpVerified, setOtpVerified] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const goNext = (nextStep: number) => {
    setDirection(1);
    setError(null);
    setStep(nextStep);
  };

  const goBack = () => {
    setDirection(-1);
    setError(null);
    setStep((s) => s - 1);
  };

  const toggleGoal = (g: string) => {
    setGoals((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  };

  const handleSendOtp = async () => {
    setError(null);
    const trimmed = phone.trim();
    if (!trimmed) {
      setError("Vui lòng nhập số điện thoại.");
      return;
    }
    if (!isValidVietnamPhone(trimmed)) {
      setError("Số điện thoại không hợp lệ. Ví dụ: 0912345678");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Không gửi được mã. Vui lòng thử lại.");
        return;
      }

      setOtpSent(true);
      setOtp(["", "", "", "", "", ""]);
      setCountdown(60);
    } catch {
      setError("Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length !== 6) {
      setError("Vui lòng nhập đủ 6 số.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), otp: code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Mã OTP không đúng.");
        return;
      }

      setOtpVerified(true);
    } catch {
      setError("Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (index + i < 6) newOtp[index + i] = d;
      });
      setOtp(newOtp);
      const next = document.getElementById(`otp-${Math.min(index + digits.length, 5)}`);
      (next as HTMLInputElement)?.focus();
      return;
    }
    const newOtp = [...otp];
    newOtp[index] = value.replace(/\D/g, "").slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      (document.getElementById(`otp-${index + 1}`) as HTMLInputElement)?.focus();
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/complete-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          date_of_birth: dateOfBirth || null,
          gender,
          fitness_goal: goals,
          phone: phone.trim() || null,
          phone_verified: otpVerified,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Đã xảy ra lỗi. Vui lòng thử lại.");
        setLoading(false);
        return;
      }

      // Use window.location to force full reload — avoids stale RSC cache

      // Use window.location instead of router.push to force a full page reload
      // This ensures Next.js fetches fresh server data (no stale cache)
      window.location.href = "/app";
    } catch {
      setError("Đã xảy ra lỗi. Vui lòng thử lại.");
      setLoading(false);
    }
  };

  const inputBase =
    "w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-800 placeholder-neutral-400 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50";
  const btnPrimary =
    "flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-semibold text-secondary-light transition-colors hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50";

  return (
    <div className="relative w-full max-w-lg mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-neutral-500 mb-2">
          <span>Bước {step} / 4</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-neutral-200 overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={false}
            animate={{ width: `${(step / 4) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/95 p-6 shadow-xl backdrop-blur-sm sm:p-8">
        <AnimatePresence mode="wait" custom={direction}>
          {/* Step 1 */}
          {step === 1 && (
            <motion.div
              key="1"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
                Thông tin cơ bản
              </h1>
              <p className="text-sm text-neutral-600">
                Giúp chúng tôi hiểu bạn hơn để cá nhân hóa trải nghiệm.
              </p>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Họ tên
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Họ và tên"
                  required
                  className={inputBase}
                  suppressHydrationWarning
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Ngày sinh
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className={inputBase}
                  suppressHydrationWarning
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Giới tính
                </label>
                <div className="flex gap-3">
                  {GENDERS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setGender(g.value as "female" | "male" | "other")}
                      className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                        gender === g.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                      }`}
                      suppressHydrationWarning
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!fullName.trim()) {
                    setError("Vui lòng nhập họ tên.");
                    return;
                  }
                  goNext(2);
                }}
                className={btnPrimary}
                suppressHydrationWarning
              >
                Tiếp tục
              </button>
            </motion.div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <motion.div
              key="2"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
                Mục tiêu của bạn
              </h1>
              <p className="text-sm text-neutral-600">
                Bạn muốn thay đổi điều gì? (Chọn 1 hoặc nhiều)
              </p>

              <div className="space-y-2">
                {GOALS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGoal(g)}
                    className={`w-full rounded-lg border-2 px-4 py-3 text-left text-sm font-medium transition-colors ${
                      goals.includes(g)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                    }`}
                    suppressHydrationWarning
                  >
                    {g}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={goBack}
                  className="flex-1 rounded-lg border-2 border-neutral-300 px-4 py-3 font-medium text-neutral-700 hover:bg-neutral-50"
                  suppressHydrationWarning
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (goals.length === 0) {
                      setError("Vui lòng chọn ít nhất một mục tiêu.");
                      return;
                    }
                    setError(null);
                    goNext(3);
                  }}
                  className="flex-1 rounded-lg bg-primary px-4 py-3 font-semibold text-secondary-light hover:bg-primary-dark"
                  suppressHydrationWarning
                >
                  Tiếp tục
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <motion.div
              key="3"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
                Xác minh số điện thoại
              </h1>
              <p className="text-sm text-neutral-600">
                Nhập số điện thoại để nhận nhắc tập và hỗ trợ.
              </p>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              {!otpSent ? (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                      Số điện thoại
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0912345678"
                      disabled={loading}
                      className={inputBase}
                      suppressHydrationWarning
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={goBack}
                      className="flex-1 rounded-lg border-2 border-neutral-300 px-4 py-3 font-medium text-neutral-700 hover:bg-neutral-50"
                      suppressHydrationWarning
                    >
                      Quay lại
                    </button>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={loading}
                      className="flex-1 rounded-lg bg-primary px-4 py-3 font-semibold text-secondary-light hover:bg-primary-dark"
                      suppressHydrationWarning
                    >
                      {loading ? "Đang gửi..." : "Gửi mã xác nhận"}
                    </button>
                  </div>
                </>
              ) : !otpVerified ? (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                      Mã OTP (6 số)
                    </label>
                    <div className="flex gap-2 justify-center">
                      {otp.map((digit, i) => (
                        <input
                          key={i}
                          id={`otp-${i}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={digit}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          disabled={loading}
                          className="h-12 w-10 rounded-lg border border-neutral-300 text-center text-lg font-semibold focus:border-primary focus:ring-2 focus:ring-primary/20"
                          suppressHydrationWarning
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    {countdown > 0 ? (
                      <span className="text-neutral-500">
                        Gửi lại mã sau {countdown}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={loading}
                        className="text-primary font-medium hover:underline"
                        suppressHydrationWarning
                      >
                        Gửi lại mã
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={loading || otp.join("").length !== 6}
                    className={btnPrimary}
                    suppressHydrationWarning
                  >
                    {loading ? "Đang xác minh..." : "Bắt đầu hành trình"}
                  </button>
                </>
              ) : (
                <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-center">
                  <p className="font-medium text-primary">
                    Số điện thoại đã được xác minh!
                  </p>
                  <button
                    type="button"
                    onClick={() => goNext(4)}
                    className={`mt-4 ${btnPrimary}`}
                    suppressHydrationWarning
                  >
                    Tiếp tục
                  </button>
                </div>
              )}

              {otpSent && !otpVerified && (
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtp(["", "", "", "", "", ""]);
                    setCountdown(0);
                  }}
                  className="text-sm text-neutral-500 hover:underline"
                  suppressHydrationWarning
                >
                  Đổi số điện thoại
                </button>
              )}

              {/* Skip — phone will be saved (with phone_verified=false) in handleComplete */}
              {!otpVerified && (
                <button
                  type="button"
                  onClick={() => goNext(4)}
                  className="w-full text-sm text-neutral-500 hover:text-neutral-700 hover:underline"
                  suppressHydrationWarning
                >
                  Bỏ qua, xác minh sau
                </button>
              )}
            </motion.div>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <motion.div
              key="4"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
                Chào mừng {fullName.trim() || "bạn"}!
              </h1>
              <p className="text-lg text-neutral-600">
                Bạn có <strong>3 ngày trải nghiệm miễn phí</strong>.
              </p>

              <div className="space-y-4">
                {PROGRAMS.slice(0, 3).map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border-2 border-neutral-200 p-4 hover:border-primary/30 transition-colors"
                  >
                    <h3 className="font-heading font-semibold text-primary">
                      {p.name}
                    </h3>
                    <p className="mt-1 text-sm text-neutral-500">{p.tagline}</p>
                    <p className="mt-2 text-sm text-neutral-600">
                      {p.description}
                    </p>
                  </div>
                ))}
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleComplete}
                disabled={loading}
                className={btnPrimary}
                suppressHydrationWarning
              >
                {loading ? (
                  <>
                    <svg
                      className="h-5 w-5 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Đang xử lý...
                  </>
                ) : (
                  "Khám phá ngay"
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
