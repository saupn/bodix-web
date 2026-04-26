"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const REFERRAL_STORAGE_KEY = "bodix_referral_code";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [referralValid, setReferralValid] = useState<{
    valid: boolean;
    referrer_name?: string;
    reward_description?: string;
  } | null>(null);
  const [referralValidating, setReferralValidating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ref = searchParams.get("ref")?.trim().toUpperCase();
    if (ref) {
      setReferralCode(ref);
      try {
        const stored = localStorage.getItem(REFERRAL_STORAGE_KEY);
        if (!stored || stored !== ref) localStorage.setItem(REFERRAL_STORAGE_KEY, ref);
      } catch {}
    }
  }, [searchParams]);

  useEffect(() => {
    if (!referralCode.trim()) {
      setReferralValid(null);
      return;
    }
    const timer = setTimeout(async () => {
      setReferralValidating(true);
      try {
        const res = await fetch(`/api/referral/validate?code=${encodeURIComponent(referralCode.trim())}`);
        const data = await res.json();
        if (data.valid) {
          setReferralValid({
            valid: true,
            referrer_name: data.referrer_name,
            reward_description: data.reward_description,
          });
          try {
            localStorage.setItem(REFERRAL_STORAGE_KEY, referralCode.trim().toUpperCase());
          } catch {}
        } else {
          setReferralValid({ valid: false });
        }
      } catch {
        setReferralValid({ valid: false });
      } finally {
        setReferralValidating(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [referralCode]);

  const validate = (): string | null => {
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      return "Vui lòng nhập họ tên.";
    }
    if (!email.trim()) {
      return "Vui lòng nhập email.";
    }
    if (!EMAIL_REGEX.test(email)) {
      return "Email không đúng định dạng.";
    }
    if (password.length < 8) {
      return "Mật khẩu phải có ít nhất 8 ký tự.";
    }
    if (password !== confirmPassword) {
      return "Mật khẩu xác nhận không khớp.";
    }
    return null;
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (referralCode.trim()) {
        try {
          localStorage.setItem(REFERRAL_STORAGE_KEY, referralCode.trim().toUpperCase());
        } catch {}
        try {
          const trackRes = await fetch("/api/referral/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: referralCode.trim().toUpperCase(), event: "signup" }),
          });
          if (!trackRes.ok) {
            try {
              localStorage.setItem(REFERRAL_STORAGE_KEY, referralCode.trim().toUpperCase());
            } catch {}
          }
        } catch {}
      }

      router.push("/onboarding");
      router.refresh();
    } catch {
      setError("Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      // Prefer NEXT_PUBLIC_APP_URL (e.g. https://bodix.fit) so production never falls back
      // to a stale Supabase Site URL. window.location.origin is the dev fallback.
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${baseUrl}/auth/callback`,
        },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
      }
    } catch {
      setError("Đã xảy ra lỗi. Vui lòng thử lại.");
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full">
      <div className="rounded-2xl border border-white/10 bg-white/95 p-6 shadow-xl backdrop-blur-sm sm:p-8">
        <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
          Đăng ký
        </h1>
        <p className="mt-4 text-sm text-neutral-600">
          Tạo tài khoản để bắt đầu hành trình BodiX của bạn.
        </p>

        <form onSubmit={handleEmailSignup} className="mt-6 space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="fullName"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              Họ tên <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Họ và tên của bạn"
              required
              disabled={loading}
              className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-800 placeholder-neutral-400 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              suppressHydrationWarning
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              Email <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email của bạn"
              required
              disabled={loading}
              className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-800 placeholder-neutral-400 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              suppressHydrationWarning
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              Mật khẩu <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 8 ký tự"
              required
              minLength={8}
              disabled={loading}
              className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-800 placeholder-neutral-400 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              suppressHydrationWarning
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              Xác nhận mật khẩu <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu"
              required
              minLength={8}
              disabled={loading}
              className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-800 placeholder-neutral-400 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              suppressHydrationWarning
            />
          </div>

          <div>
            <label
              htmlFor="referralCode"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              Mã giới thiệu (nếu có)
            </label>
            <input
              id="referralCode"
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              placeholder="BODIX-XXXX"
              disabled={loading}
              className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-800 placeholder-neutral-400 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              suppressHydrationWarning
            />
            {referralValidating && (
              <p className="mt-1 text-xs text-neutral-500">Đang kiểm tra...</p>
            )}
            {!referralValidating && referralValid?.valid && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-success">
                <span>✓</span>
                {referralValid.referrer_name} đã giới thiệu bạn! Bạn được {referralValid.reward_description ?? "giảm 10%"}
              </p>
            )}
            {!referralValidating && referralValid && !referralValid.valid && referralCode.trim() && (
              <p className="mt-1 text-xs text-red-600">Mã không hợp lệ</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-semibold text-secondary-light transition-colors hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
            suppressHydrationWarning
          >
            {loading ? (
              <>
                <svg
                  className="h-5 w-5 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
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
                Đang đăng ký...
              </>
            ) : (
              "Đăng ký"
            )}
          </button>

          <p className="text-sm text-gray-500 mt-4">(<span className="text-red-500">*</span>) Bắt buộc</p>
        </form>

        <div className="mt-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-neutral-200" />
          <span className="text-sm text-neutral-500">hoặc</span>
          <div className="h-px flex-1 bg-neutral-200" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border-2 border-neutral-300 bg-white px-4 py-3 font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
          suppressHydrationWarning
        >
          <GoogleIcon />
          Đăng ký với Google
        </button>

        <p className="mt-6 text-center text-sm text-neutral-600">
          Đã có tài khoản?{" "}
          <Link
            href="/login"
            className="font-semibold text-primary hover:text-primary-dark hover:underline"
          >
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
