"use client";

import { useState } from "react";

export default function LeadCapture() {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting" || status === "success") return;

    if (!/^[0-9]{10,11}$/.test(phone)) {
      setStatus("error");
      setErrorMessage("Số điện thoại phải có 10-11 chữ số.");
      return;
    }

    setStatus("submitting");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, source: "landing_lead_form" }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setStatus("error");
        setErrorMessage(data?.error ?? "Có lỗi xảy ra. Vui lòng thử lại.");
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage("Không kết nối được. Vui lòng thử lại.");
    }
  }

  return (
    <section className="py-12 px-4 bg-[#2D4A3E]/5">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
          Nhận hướng dẫn miễn phí qua Zalo
        </h2>
        <p className="text-gray-700 mb-6">
          Để lại số điện thoại, BodiX sẽ gửi cho bạn:<br />
          • Bí quyết hoàn thành chương trình tập đầu tiên<br />
          • Lịch tập mẫu 21 ngày tham khảo<br />
          • Cập nhật khi đợt mới mở
        </p>

        {status === "success" ? (
          <p className="text-base font-medium text-[#2D4A3E]">
            Đã ghi nhận! BodiX sẽ liên hệ qua Zalo.
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          >
            <input
              type="tel"
              name="phone"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              placeholder="Số điện thoại Zalo"
              pattern="[0-9]{10,11}"
              disabled={status === "submitting"}
              className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:border-primary outline-none disabled:bg-gray-100"
            />
            <button
              type="submit"
              disabled={status === "submitting"}
              className="px-6 py-3 bg-[#2D4A3E] text-white rounded-xl font-medium hover:bg-[#1a2e26] disabled:opacity-60"
            >
              {status === "submitting" ? "Đang gửi..." : "Nhận miễn phí"}
            </button>
          </form>
        )}

        {status === "error" && errorMessage && (
          <p className="mt-3 text-sm text-red-600">{errorMessage}</p>
        )}

        <p className="text-xs text-gray-500 mt-3">
          Chúng tôi không spam. Bạn có thể bỏ theo dõi bất cứ lúc nào.
        </p>
      </div>
    </section>
  );
}
