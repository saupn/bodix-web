"use client";

import { useState } from "react";

const DOWNLOAD_URL = "/guides/bodix-fuel-guide.pdf";

export function GuideDownload() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Vui lòng nhập email.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/leads/download-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: "homepage" }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Đã xảy ra lỗi.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <section className="border-t border-neutral-200 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <h2 className="font-heading text-2xl font-bold text-[#2D4A3E] sm:text-3xl">
            Đã gửi thành công!
          </h2>
          <p className="mt-4 text-neutral-600">
            Nhấn nút bên dưới để tải xuống Cẩm nang BodiX Fuel Guide.
          </p>
          <a
            href={DOWNLOAD_URL}
            download
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#2D4A3E] px-8 py-4 font-semibold text-white hover:bg-[#243d32]"
          >
            Tải sách ngay
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="border-t border-neutral-200 bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-2xl px-4 text-center">
        <h2 className="font-heading text-2xl font-bold text-[#2D4A3E] sm:text-3xl">
          Nhận miễn phí: Cẩm nang BodiX Fuel Guide
        </h2>
        <p className="mt-4 text-neutral-600">
          Hướng dẫn dinh dưỡng, giấc ngủ và tập luyện cơ bản cho phụ nữ Việt Nam
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email của bạn"
            required
            disabled={loading}
            className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-800 placeholder-neutral-400 focus:border-[#2D4A3E] focus:outline-none focus:ring-2 focus:ring-[#2D4A3E]/20 sm:w-72"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[#2D4A3E] px-6 py-3 font-semibold text-white hover:bg-[#243d32] disabled:opacity-50"
          >
            {loading ? "Đang xử lý..." : "Nhận sách miễn phí"}
          </button>
        </form>

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}
      </div>
    </section>
  );
}
