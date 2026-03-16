"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const DOWNLOAD_URL = "/guides/bodix-fuel-guide.pdf";

function TangSachContent() {
  const searchParams = useSearchParams();
  const fromCode = searchParams.get("from")?.trim().toUpperCase() || null;

  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!fromCode) return;
    fetch(`/api/leads/referrer-name?code=${encodeURIComponent(fromCode)}`)
      .then((r) => r.ok && r.json())
      .then((d) => d?.name && setReferrerName(d.name))
      .catch(() => {});
  }, [fromCode]);

  const displayReferrer = referrerName || fromCode || null;

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
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          referral_code: fromCode || undefined,
        }),
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

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-lg">
          {success ? (
            <div className="text-center">
              <h1 className="font-heading text-2xl font-bold text-[#2D4A3E]">
                Tải sách thành công!
              </h1>
              <a
                href={DOWNLOAD_URL}
                download
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#2D4A3E] px-6 py-4 font-semibold text-white hover:bg-[#243d32]"
              >
                Tải Cẩm nang BodiX Fuel Guide
              </a>
              <div className="mt-8 rounded-xl border-2 border-[#2D4A3E]/20 bg-[#2D4A3E]/5 p-6">
                <p className="font-medium text-[#2D4A3E]">
                  Muốn kết quả thật sự? Tham gia BodiX 21
                </p>
                <Link
                  href="/pricing"
                  className="mt-4 block w-full rounded-lg bg-[#2D4A3E] py-3 text-center font-semibold text-white hover:bg-[#243d32]"
                >
                  Xem chương trình →
                </Link>
              </div>
            </div>
          ) : (
            <>
              <h1 className="font-heading text-2xl font-bold text-[#2D4A3E] text-center">
                {displayReferrer
                  ? `${displayReferrer} muốn tặng bạn một món quà`
                  : "Nhận miễn phí: Cẩm nang BodiX Fuel Guide"}
              </h1>
              {!displayReferrer && (
                <p className="mt-2 text-center text-neutral-600">
                  Hướng dẫn dinh dưỡng, giấc ngủ và tập luyện cơ bản cho phụ nữ Việt Nam
                </p>
              )}

              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                    Tên (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tên của bạn"
                    className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-800 placeholder-neutral-400 focus:border-[#2D4A3E] focus:outline-none focus:ring-2 focus:ring-[#2D4A3E]/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email của bạn"
                    required
                    disabled={loading}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-800 placeholder-neutral-400 focus:border-[#2D4A3E] focus:outline-none focus:ring-2 focus:ring-[#2D4A3E]/20 disabled:opacity-50"
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-[#2D4A3E] py-4 font-semibold text-white hover:bg-[#243d32] disabled:opacity-50"
                >
                  {loading ? "Đang xử lý..." : "Nhận sách ngay"}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function TangSachPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Đang tải...</div>}>
      <TangSachContent />
    </Suspense>
  );
}
