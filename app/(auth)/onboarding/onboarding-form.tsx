"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, CheckCircle, Loader2, ExternalLink, Gift, Percent } from "lucide-react";
import { PROGRAMS, REFERRAL_BASE } from "@/lib/constants";
import { suggestReferralCodes } from "@/lib/referral/utils";
import { createClient } from "@/lib/supabase/client";

const REFERRAL_STORAGE_KEY = "bodix_referral_code";

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
  const [step, setStep] = useState(0); // 0 = loading
  const [direction, setDirection] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [fullName, setFullName] = useState(initialName);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<"female" | "male" | "other">("female");

  // Step 2
  const [goals, setGoals] = useState<string[]>([]);

  // Step 3 — Zalo verify code flow
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [verifyStage, setVerifyStage] = useState<"input" | "waiting" | "success">("input");
  const [verifyCode, setVerifyCode] = useState("");
  const [zaloOaLink, setZaloOaLink] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [manualChecking, setManualChecking] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Other
  const [showFollowOA, setShowFollowOA] = useState(false);
  const [referralCodeFromStorage, setReferralCodeFromStorage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(REFERRAL_STORAGE_KEY);
      if (stored) setReferralCodeFromStorage(stored.trim().toUpperCase());
    } catch {}
  }, []);

  // On mount: check profile completion and skip to first incomplete step
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setStep(1); setInitializing(false); return; }

      const [{ data: profile }, { data: referralCodes }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, date_of_birth, gender, fitness_goal, phone, phone_verified, onboarding_completed")
          .eq("id", user.id)
          .single(),
        supabase
          .from("referral_codes")
          .select("id")
          .eq("user_id", user.id)
          .limit(1),
      ]);

      if (!profile) { setStep(1); setInitializing(false); return; }

      // Already completed onboarding — redirect immediately
      if (profile.onboarding_completed === true) {
        console.log("[onboarding-form] Already completed, redirecting to /app");
        window.location.href = "/app";
        return;
      }

      // Populate form state from existing profile data
      if (profile.full_name) setFullName(profile.full_name);
      if (profile.date_of_birth) setDateOfBirth(profile.date_of_birth);
      if (profile.gender) setGender(profile.gender as "female" | "male" | "other");
      if (Array.isArray(profile.fitness_goal) && profile.fitness_goal.length > 0) {
        setGoals(profile.fitness_goal as string[]);
      }
      if (profile.phone) setPhone(profile.phone);
      if (profile.phone_verified) setPhoneVerified(true);

      // Determine first incomplete step
      const step1Done = profile.gender != null;
      const step2Done = profile.fitness_goal != null &&
        (Array.isArray(profile.fitness_goal) ? profile.fitness_goal.length > 0 : true);
      const step3Done = profile.phone_verified === true;
      const step4Done = true; // info-only step, skip if prior steps done
      const step5Done = (referralCodes?.length ?? 0) > 0;

      if (step1Done && step2Done && step3Done && step4Done && step5Done) {
        // All steps done but onboarding_completed not set — set it now and redirect
        console.log("[onboarding-form] All steps done, completing onboarding");
        await fetch("/api/auth/complete-onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: profile.full_name,
            date_of_birth: profile.date_of_birth,
            gender: profile.gender,
            fitness_goal: profile.fitness_goal,
            phone: profile.phone,
            phone_verified: profile.phone_verified,
          }),
        });
        window.location.href = "/app";
        return;
      }

      const firstIncomplete = !step1Done ? 1
        : !step2Done ? 2
        : !step3Done ? 3
        : !step4Done ? 4
        : 5;

      setStep(firstIncomplete);
      setInitializing(false);
    })();
  }, []);

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

  // ── Step 3: Phone validation ──

  function handlePhoneChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    setPhone(digits);
    if (!digits) { setPhoneError(null); return; }
    if (!digits.startsWith("0")) { setPhoneError("SĐT phải bắt đầu bằng 0."); return; }
    if (digits.length < 10) { setPhoneError("SĐT phải đủ 10 số."); return; }
    setPhoneError(null);
  }

  const isPhoneValid = phone.length === 10 && phone.startsWith("0");

  // ── Step 3: Request verify code ──

  async function handleRequestVerify() {
    if (!isPhoneValid || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/request-phone-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Có lỗi xảy ra.");
        return;
      }

      setVerifyCode(data.verify_code);
      setZaloOaLink(data.zalo_oa_link);
      setSecondsLeft(data.expires_in);
      setShowResend(false);
      setCopied(false);
      setVerifyStage("waiting");
    } catch {
      setError("Không thể kết nối. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: Countdown timer ──

  useEffect(() => {
    if (verifyStage !== "waiting") return;

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setShowResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    resendTimeoutRef.current = setTimeout(() => setShowResend(true), 120_000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (resendTimeoutRef.current) clearTimeout(resendTimeoutRef.current);
    };
  }, [verifyStage]);

  // ── Step 3: Polling for verification ──

  const checkVerified = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.warn("[zalo-poll] auth failed:", authError?.message || "no user");
        return;
      }

      // Bypass browser/PostgREST cache with direct fetch + no-store
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=phone_verified`,
        {
          headers: {
            "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            "Authorization": `Bearer ${session?.access_token}`,
            "Accept": "application/vnd.pgrst.object+json",
          },
          cache: "no-store",
        }
      );

      if (!res.ok) {
        console.warn("[zalo-poll] fetch failed:", res.status, await res.text());
        return;
      }

      const data = await res.json();
      console.log("[zalo-poll] fresh result:", data?.phone_verified);

      if (data?.phone_verified) {
        setPhoneVerified(true);
        setVerifyStage("success");
      }
    } catch (err) {
      console.warn("[zalo-poll] unexpected error:", err);
    }
  }, []);

  useEffect(() => {
    if (verifyStage !== "waiting") return;

    pollingRef.current = setInterval(checkVerified, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [verifyStage, checkVerified]);

  const handleManualCheck = useCallback(async () => {
    setManualChecking(true);
    await checkVerified();
    setManualChecking(false);
  }, [checkVerified]);

  // ── Step 3: Success auto-advance ──

  useEffect(() => {
    if (verifyStage !== "success") return;
    const t = setTimeout(() => goNext(4), 1500);
    return () => clearTimeout(t);
  }, [verifyStage]);

  // ── Step 3: Copy ──

  async function handleCopy() {
    await navigator.clipboard.writeText(verifyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  // ── Complete onboarding ──

  const handleComplete = async () => {
    setLoading(true);
    setError(null);

    try {
      const referredBy = referralCodeFromStorage || undefined;
      const payload = {
        full_name: fullName.trim() || null,
        date_of_birth: dateOfBirth || null,
        gender: gender || null,
        fitness_goal: goals.length > 0 ? goals : null,
        phone: phone.trim() || null,
        phone_verified: phoneVerified,
        referred_by: referredBy,
      };

      console.log("[onboarding] handleComplete payload:", payload);

      const res = await fetch("/api/auth/complete-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      console.log("[onboarding] handleComplete response:", res.status, data);

      if (!res.ok) {
        setError(data.error || "Đã xảy ra lỗi. Vui lòng thử lại.");
        setLoading(false);
        return;
      }

      try {
        localStorage.removeItem(REFERRAL_STORAGE_KEY);
      } catch {}

      // Full page reload to ensure Server Components read fresh data
      window.location.href = "/app";
    } catch (err) {
      console.error("[onboarding] handleComplete error:", err);
      setError("Đã xảy ra lỗi. Vui lòng thử lại.");
      setLoading(false);
    }
  };

  const inputBase =
    "w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-800 placeholder-neutral-400 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50";
  const btnPrimary =
    "flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-semibold text-secondary-light transition-colors hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50";

  if (initializing) {
    return (
      <div className="relative w-full max-w-lg mx-auto">
        <div className="mb-8">
          <div className="h-4 w-24 rounded bg-neutral-200 animate-pulse mb-2" />
          <div className="h-1.5 w-full rounded-full bg-neutral-200" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/95 p-6 shadow-xl backdrop-blur-sm sm:p-8 space-y-4">
          <div className="h-8 w-48 rounded bg-neutral-200 animate-pulse" />
          <div className="h-4 w-64 rounded bg-neutral-200 animate-pulse" />
          <div className="h-12 w-full rounded-lg bg-neutral-200 animate-pulse" />
          <div className="h-12 w-full rounded-lg bg-neutral-200 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-lg mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-neutral-500 mb-2">
          <span>Bước {step} / 5</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-neutral-200 overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={false}
            animate={{ width: `${(step / 5) * 100}%` }}
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

          {/* Step 3 — Kết nối Zalo */}
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
              {/* If already verified, show success immediately */}
              {(phoneVerified || verifyStage === "success") ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="flex flex-col items-center py-8"
                >
                  <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                  <h1 className="font-heading text-2xl font-bold text-primary">
                    Đã kết nối Zalo thành công!
                  </h1>
                </motion.div>
              ) : verifyStage === "waiting" ? (
                /* ── Trạng thái 2: Chờ xác minh ── */
                <>
                  <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
                    Xác minh qua Zalo
                  </h1>

                  {/* Verify code display */}
                  <div className="flex items-center justify-center gap-3">
                    <div className="bg-green-50 rounded-lg px-6 py-4 text-center">
                      <span className="font-mono font-bold text-3xl tracking-widest select-all text-primary">
                        {verifyCode}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="p-2.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors"
                      title="Copy mã"
                    >
                      {copied ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5 text-neutral-500" />
                      )}
                    </button>
                  </div>

                  {/* 3 steps */}
                  <div className="space-y-3 mt-2">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-secondary-light flex items-center justify-center text-sm font-bold">
                        1
                      </span>
                      <div className="flex-1 flex items-center gap-2 pt-0.5">
                        <span className="text-sm text-neutral-700">Mở Zalo và tìm trang BodiX</span>
                        <button
                          type="button"
                          onClick={() => window.open(zaloOaLink, "_blank")}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-primary/30 text-primary text-xs font-medium hover:bg-primary/5 transition-colors"
                        >
                          Mở Zalo <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-secondary-light flex items-center justify-center text-sm font-bold">
                        2
                      </span>
                      <span className="text-sm text-neutral-700 pt-0.5">
                        Bấm <strong>Quan tâm</strong> để theo dõi BodiX
                      </span>
                    </div>

                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-secondary-light flex items-center justify-center text-sm font-bold">
                        3
                      </span>
                      <span className="text-sm text-neutral-700 pt-0.5">
                        Gửi tin nhắn <span className="font-mono font-bold text-primary">{verifyCode}</span> cho BodiX
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-400 text-center mt-1">
                    Sau khi gửi tin nhắn, trang này sẽ tự động cập nhật
                  </p>

                  {/* Countdown */}
                  <p className="text-center text-sm text-neutral-500">
                    Mã có hiệu lực trong{" "}
                    <span className="font-mono font-medium text-neutral-700">
                      {formatTime(secondsLeft)}
                    </span>
                  </p>

                  {/* Error */}
                  {error && (
                    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  {/* Manual check fallback */}
                  <button
                    type="button"
                    onClick={handleManualCheck}
                    disabled={manualChecking}
                    className="w-full rounded-lg border-2 border-primary/30 px-4 py-3 text-sm font-medium text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                  >
                    {manualChecking ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Đang kiểm tra...
                      </span>
                    ) : (
                      "Tôi đã gửi mã"
                    )}
                  </button>

                  {/* Resend */}
                  {showResend && (
                    <div className="flex justify-center pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setVerifyStage("input");
                          setShowResend(false);
                        }}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Gửi lại mã
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* ── Trạng thái 1: Nhập SĐT ── */
                <>
                  <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
                    Kết nối Zalo
                  </h1>
                  <p className="text-sm text-neutral-600">
                    Nhập số điện thoại Zalo để nhận nhắc tập mỗi ngày
                  </p>

                  {error && (
                    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRequestVerify()}
                      placeholder="Số điện thoại Zalo của bạn"
                      disabled={loading}
                      className={`${inputBase} ${
                        phoneError && phone.length >= 3
                          ? "border-red-400 focus:ring-red-400/20"
                          : ""
                      }`}
                      suppressHydrationWarning
                    />
                    {phoneError && phone.length >= 3 && (
                      <p className="mt-1.5 text-sm text-red-500">{phoneError}</p>
                    )}
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
                      onClick={handleRequestVerify}
                      disabled={!isPhoneValid || loading}
                      className={`flex-1 ${btnPrimary}`}
                      suppressHydrationWarning
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        "Tiếp tục"
                      )}
                    </button>
                  </div>

                </>
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

              <button
                type="button"
                onClick={() => goNext(5)}
                className={btnPrimary}
                suppressHydrationWarning
              >
                Tiếp tục
              </button>
            </motion.div>
          )}

          {/* Step 5: Chia sẻ BodiX, nhận quà */}
          {step === 5 && (
            <ReferralStep
              fullName={fullName}
              direction={direction}
              slideVariants={slideVariants}
              btnPrimary={btnPrimary}
              onComplete={handleComplete}
              loading={loading}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Step 5: Referral benefits & code ─────────────────────────────────────────

function ReferralStep({
  fullName,
  direction,
  slideVariants: variants,
  btnPrimary,
  onComplete,
  loading: parentLoading,
}: {
  fullName: string;
  direction: number;
  slideVariants: typeof slideVariants;
  btnPrimary: string;
  onComplete: () => void;
  loading: boolean;
}) {
  const [referralCode, setReferralCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [codeSaved, setCodeSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Auto-generate code from name on mount
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user already has a referral code
      const { data: profile } = await supabase
        .from("profiles")
        .select("referral_code")
        .eq("id", user.id)
        .single();

      if (profile?.referral_code) {
        setReferralCode(profile.referral_code);
        setCodeSaved(true);
        return;
      }

      // Auto-generate from name
      const suggestions = suggestReferralCodes(fullName);
      if (suggestions.length === 0) return;

      // Find the first available code
      for (const code of suggestions) {
        const res = await fetch(`/api/referral/check?code=${encodeURIComponent(code)}`);
        const data = await res.json();
        if (data.available) {
          setReferralCode(code);
          break;
        }
      }
    })();
  }, [fullName]);

  const handleSaveAndComplete = async () => {
    if (!referralCode) {
      await onComplete();
      return;
    }

    if (codeSaved) {
      await onComplete();
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/referral/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: referralCode }),
      });
      if (res.ok) {
        setCodeSaved(true);
      }
    } catch {
      // Non-fatal — proceed anyway
    } finally {
      setSaving(false);
    }
    await onComplete();
  };

  const referralLink = referralCode ? `${REFERRAL_BASE}?ref=${referralCode}` : "";
  const shareText = referralCode
    ? `Mình đang tập BodiX — chương trình fitness hoàn thành được! Bạn dùng mã ${referralCode} để được giảm 10%: ${referralLink}`
    : "";

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <motion.div
      key="5"
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      <div>
        <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
          Chia sẻ BodiX, nhận quà
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Mời bạn bè tập cùng và nhận thưởng cho mỗi người đăng ký thành công
        </p>
      </div>

      {/* Benefit cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 text-center">
          <Gift className="mx-auto h-8 w-8 text-primary mb-2" />
          <p className="text-sm font-semibold text-primary">Voucher 100.000đ</p>
          <p className="mt-1 text-xs text-neutral-600">Cho mỗi người đăng ký thành công</p>
        </div>
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 text-center">
          <Percent className="mx-auto h-8 w-8 text-primary mb-2" />
          <p className="text-sm font-semibold text-primary">Bạn bè giảm 10%</p>
          <p className="mt-1 text-xs text-neutral-600">Khi đăng ký qua mã của bạn</p>
        </div>
      </div>

      {/* Referral code display */}
      {referralCode && (
        <div className="rounded-xl border-2 border-primary/30 bg-white p-4">
          <p className="text-xs font-medium text-neutral-500 mb-2">Mã giới thiệu của bạn</p>
          <div className="flex items-center gap-3">
            <span className="flex-1 text-center font-mono text-2xl font-bold tracking-widest text-primary select-all">
              {referralCode}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="rounded-lg border border-neutral-200 p-2.5 hover:bg-neutral-50 transition-colors"
            >
              {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-neutral-500" />}
            </button>
          </div>

          {/* Share link */}
          <div className="mt-3 pt-3 border-t border-neutral-100">
            <p className="text-xs text-neutral-500 mb-1.5">Link chia sẻ</p>
            <div className="flex items-center gap-2">
              <p className="flex-1 text-xs font-mono text-neutral-600 truncate">{referralLink}</p>
              <button
                type="button"
                onClick={handleCopyLink}
                className="shrink-0 rounded-md border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
              >
                {linkCopied ? "Đã copy!" : "Copy link"}
              </button>
            </div>
          </div>

          {/* Zalo share */}
          <a
            href={`https://zalo.me/share?url=${encodeURIComponent(referralLink)}&title=${encodeURIComponent('Tham gia BodiX - Giảm 10% với mã giới thiệu của tôi')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0068FF] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            Chia sẻ qua Zalo
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}

      {/* Fine print */}
      <p className="text-xs text-neutral-400 text-center">
        Voucher được kích hoạt khi bạn bè hoàn tất thanh toán. Bạn có thể xem và quản lý voucher trong phần Hồ sơ.
      </p>

      {/* Continue button */}
      <button
        type="button"
        onClick={handleSaveAndComplete}
        disabled={saving || parentLoading}
        className={btnPrimary}
        suppressHydrationWarning
      >
        {saving || parentLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          "Tiếp tục"
        )}
      </button>
    </motion.div>
  );
}
