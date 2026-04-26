"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot-password flow
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
          setError("Email hoặc mật khẩu không đúng.");
        } else {
          setError(authError.message);
        }
        return;
      }

      router.push("/app");
      router.refresh();
    } catch {
      setError("Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendReset = async () => {
    setResetError(null);
    setResetSent(false);
    if (!resetEmail.trim()) {
      setResetError("Vui lòng nhập email.");
      return;
    }
    setResetLoading(true);
    try {
      const supabase = createClient();
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : "https://bodix.fit/reset-password";
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
        resetEmail.trim(),
        { redirectTo }
      );
      if (resetErr) {
        setResetError("Không gửi được. Kiểm tra lại email.");
        return;
      }
      setResetSent(true);
    } catch {
      setResetError("Không gửi được. Kiểm tra lại email.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
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
      {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/95 p-6 shadow-xl backdrop-blur-sm sm:p-8">
          <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
            Đăng nhập
          </h1>
          <p className="mt-4 text-sm text-neutral-600">
            Chào mừng bạn trở lại. Đăng nhập để tiếp tục hành trình.
          </p>

          <form onSubmit={handleEmailLogin} className="mt-6 space-y-4">
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
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-neutral-700"
              >
                Email
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
                Mật khẩu
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                required
                disabled={loading}
                className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-800 placeholder-neutral-400 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                suppressHydrationWarning
              />
              <div className="mt-1.5 text-right">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword((v) => !v);
                    setResetSent(false);
                    setResetError(null);
                    if (!resetEmail) setResetEmail(email);
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  Quên mật khẩu?
                </button>
              </div>
            </div>

            {showForgotPassword && (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <p className="mb-2 text-sm text-neutral-600">
                  Nhập email để nhận link đặt lại mật khẩu
                </p>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Email"
                  className="mb-3 w-full rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-800 placeholder-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  onClick={handleSendReset}
                  disabled={resetLoading}
                  className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-secondary-light hover:bg-primary-dark disabled:opacity-50"
                >
                  {resetLoading ? "Đang gửi..." : "Gửi link đặt lại mật khẩu"}
                </button>
                {resetSent && (
                  <p className="mt-2 text-sm text-green-600">
                    Đã gửi! Kiểm tra email.
                  </p>
                )}
                {resetError && (
                  <p className="mt-2 text-sm text-red-600">{resetError}</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetSent(false);
                    setResetError(null);
                  }}
                  className="mt-2 text-sm text-neutral-500 hover:text-neutral-700"
                >
                  ← Quay lại đăng nhập
                </button>
              </div>
            )}

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
                  Đang đăng nhập...
                </>
              ) : (
                "Đăng nhập"
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-neutral-200" />
            <span className="text-sm text-neutral-500">hoặc</span>
            <div className="h-px flex-1 bg-neutral-200" />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border-2 border-neutral-300 bg-white px-4 py-3 font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
            suppressHydrationWarning
          >
            <GoogleIcon />
            Đăng nhập với Google
          </button>

          <p className="mt-6 text-center text-sm text-neutral-600">
            Chưa có tài khoản?{" "}
            <Link
              href="/signup"
              className="font-semibold text-primary hover:text-primary-dark hover:underline"
            >
              Đăng ký
            </Link>
          </p>
        </div>
    </div>
  );
}
