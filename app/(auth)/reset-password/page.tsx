"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  // Supabase puts the access_token in the URL hash on redirect from the email link.
  // The client picks it up automatically; we just wait for the recovery session to land.
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasSession(!!data.session);
      setAuthReady(true);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          setHasSession(!!session);
          setAuthReady(true);
        }
      }
    );
    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Mật khẩu cần tối thiểu 6 ký tự.");
      return;
    }
    if (password !== confirm) {
      setError("Hai mật khẩu không khớp.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) {
        setError(updateError.message || "Không đặt được mật khẩu mới.");
        return;
      }
      setDone(true);
      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 2000);
    } catch {
      setError("Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full">
      <div className="rounded-2xl border border-white/10 bg-white/95 p-6 shadow-xl backdrop-blur-sm sm:p-8">
        <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
          Đặt lại mật khẩu
        </h1>

        {!authReady ? (
          <p className="mt-4 text-sm text-neutral-600">Đang xác thực…</p>
        ) : !hasSession ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-neutral-600">
              Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu
              cầu link mới từ trang đăng nhập.
            </p>
            <Link
              href="/login"
              className="inline-block text-sm font-semibold text-primary hover:underline"
            >
              ← Quay lại đăng nhập
            </Link>
          </div>
        ) : done ? (
          <div className="mt-4 space-y-3">
            <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              ✅ Đặt lại mật khẩu thành công. Đang chuyển về trang đăng nhập…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
                htmlFor="new-password"
                className="mb-1.5 block text-sm font-medium text-neutral-700"
              >
                Mật khẩu mới
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                required
                minLength={6}
                disabled={loading}
                className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-800 placeholder-neutral-400 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                suppressHydrationWarning
              />
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="mb-1.5 block text-sm font-medium text-neutral-700"
              >
                Xác nhận mật khẩu
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                required
                minLength={6}
                disabled={loading}
                className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-800 placeholder-neutral-400 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                suppressHydrationWarning
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-semibold text-secondary-light transition-colors hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
              suppressHydrationWarning
            >
              {loading ? "Đang lưu…" : "Đặt mật khẩu mới"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
