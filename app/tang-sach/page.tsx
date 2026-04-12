"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { GIFT_BOOK_DESCRIPTION } from "@/lib/constants";

const PDF_PATH = "/guides/bodix-fuel-guide.pdf";

function formatPhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  return digits;
}

function isValidVnPhone10(digits: string): boolean {
  return digits.length === 10 && digits.startsWith("0");
}

function TangSachContent() {
  const searchParams = useSearchParams();
  const fromCode = searchParams.get("from")?.trim().toUpperCase() || null;

  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(PDF_PATH);

  useEffect(() => {
    if (!fromCode) return;
    fetch(`/api/leads/referrer-name?code=${encodeURIComponent(fromCode)}`)
      .then((r) => r.ok && r.json())
      .then((d) => {
        if (d?.name) setReferrerName(d.name);
      })
      .catch(() => {});
  }, [fromCode]);

  const displayReferrer = fromCode ? referrerName || "Một người bạn" : null;

  const handlePhoneChange = (value: string) => {
    setPhone(formatPhoneDigits(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fromCode) {
      setError("Cần link tặng hợp lệ.");
      return;
    }
    if (!isValidVnPhone10(phone)) {
      setError("Vui lòng nhập số điện thoại 10 số (bắt đầu bằng 0).");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/leads/download-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          name: name.trim() || undefined,
          referral_code: fromCode,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Đã xảy ra lỗi.");
        return;
      }

      if (data.downloadUrl) setDownloadUrl(data.downloadUrl);
      setSuccess(true);
    } catch {
      setError("Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const signupHref = fromCode
    ? `/signup?program=bodix21&ref=${encodeURIComponent(fromCode)}`
    : "/signup";

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-lg">
          {success ? (
            <div className="text-center">
              <h1 className="font-heading text-2xl font-bold text-[#2D4A3E]">
                ✅ Cảm ơn! Đây là Sách của bạn.
              </h1>
              <a
                href={downloadUrl}
                download
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#2D4A3E] px-6 py-4 font-semibold text-white hover:bg-[#243d32]"
              >
                📥 Tải Sách
              </a>
              <div className="my-8 h-px w-full bg-neutral-200" />
              <div className="rounded-xl border-2 border-[#2D4A3E]/20 bg-[#2D4A3E]/5 p-6 text-left">
                <p className="font-heading text-lg font-semibold text-[#2D4A3E]">
                  Muốn thay đổi cơ thể trong 21 ngày?
                </p>
                <p className="mt-2 text-sm text-neutral-600">
                  Tập thử 3 ngày miễn phí. Không cần nhập thẻ ngân hàng.
                </p>
                <Link
                  href={signupHref}
                  className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#2D4A3E] py-4 font-semibold text-white hover:bg-[#243d32]"
                >
                  Tập thử miễn phí →
                </Link>
              </div>
            </div>
          ) : !fromCode ? (
            <div className="text-center">
              <h1 className="font-heading text-2xl font-bold text-[#2D4A3E]">
                Sách Tại sao nhịn ăn không giúp bạn gọn hơn
              </h1>
              <p className="mt-3 text-neutral-600">
                Bạn cần link tặng từ một thành viên BodiX để nhận cẩm nang.
              </p>
              <Link
                href="/"
                className="mt-8 inline-flex w-full items-center justify-center rounded-xl border-2 border-[#2D4A3E] py-4 font-semibold text-[#2D4A3E] hover:bg-[#2D4A3E]/5"
              >
                Tìm hiểu BodiX →
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-heading text-2xl font-bold text-[#2D4A3E] text-center">
                {displayReferrer} muốn tặng bạn một món quà
              </h1>
              <p className="mt-3 text-center text-sm text-neutral-600 leading-relaxed">
                {GIFT_BOOK_DESCRIPTION}
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                    Số điện thoại <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="0909 123 456"
                    disabled={loading}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-800 placeholder-neutral-400 focus:border-[#2D4A3E] focus:outline-none focus:ring-2 focus:ring-[#2D4A3E]/20 disabled:opacity-50"
                  />
                  <p className="mt-1 text-xs text-neutral-500">
                    Để nhận thông báo về chương trình BodiX qua Zalo
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                    Họ tên (tuỳ chọn)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tên của bạn"
                    disabled={loading}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-800 placeholder-neutral-400 focus:border-[#2D4A3E] focus:outline-none focus:ring-2 focus:ring-[#2D4A3E]/20 disabled:opacity-50"
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-[#2D4A3E] py-4 font-semibold text-white hover:bg-[#243d32] disabled:opacity-50"
                >
                  {loading ? "Đang xử lý..." : "Nhận Sách miễn phí"}
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
