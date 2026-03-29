"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const PARTNER_TYPES = [
  { value: "pt", label: "PT / Trainer" },
  { value: "kol", label: "KOL / Influencer" },
  { value: "gym_owner", label: "Chủ phòng gym / studio" },
  { value: "blogger", label: "Blogger / Content creator" },
  { value: "other", label: "Khác" },
] as const;

const CHANNELS = [
  { value: "zalo", label: "Zalo" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "website", label: "Website / Blog" },
  { value: "offline", label: "Offline" },
] as const;

export function AffiliateRegistrationClient() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [partnerType, setPartnerType] = useState("");
  const [primaryChannel, setPrimaryChannel] = useState("");
  const [socialLink, setSocialLink] = useState("");
  const [estimatedAudience, setEstimatedAudience] = useState("");
  const [applicationNote, setApplicationNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/affiliate/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          partner_type: partnerType,
          primary_channel: primaryChannel,
          social_link: socialLink.trim() || undefined,
          estimated_audience: estimatedAudience.trim() || undefined,
          application_note: applicationNote.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Có lỗi xảy ra.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Không thể kết nối. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-800 placeholder-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
  const selectClass =
    "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/logo.png"
              alt="BodiX"
              width={100}
              height={34}
              className="object-contain"
            />
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-primary hover:underline"
          >
            Đăng nhập
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        {/* Hero */}
        <div className="text-center">
          <h1 className="font-heading text-3xl font-bold text-primary sm:text-4xl">
            Chương trình Đối tác BodiX
          </h1>
          <p className="mt-3 text-lg text-neutral-600">
            Nhận <span className="font-bold text-primary">40% hoa hồng</span> cho
            mỗi người đăng ký thành công qua bạn
          </p>
        </div>

        {/* Benefits */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 text-center">
            <p className="text-3xl font-bold text-primary">40%</p>
            <p className="mt-1 text-sm text-neutral-600">
              Hoa hồng trên mỗi đơn hàng thực tế
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 text-center">
            <p className="text-3xl font-bold text-primary">10%</p>
            <p className="mt-1 text-sm text-neutral-600">
              Giảm giá cho người dùng qua link của bạn
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 text-center">
            <p className="text-3xl font-bold text-primary">500K</p>
            <p className="mt-1 text-sm text-neutral-600">
              Payout tối thiểu, chuyển khoản trực tiếp
            </p>
          </div>
        </div>

        {/* Who is this for */}
        <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="font-heading text-lg font-semibold text-primary">
            Dành cho ai?
          </h2>
          <ul className="mt-3 space-y-2 text-neutral-600">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-primary">&#x2713;</span>
              PT / Personal Trainer muốn giới thiệu cho học viên
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-primary">&#x2713;</span>
              KOL / Influencer trong lĩnh vực fitness, sức khỏe
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-primary">&#x2713;</span>
              Chủ phòng gym / studio muốn cung cấp thêm giá trị cho hội viên
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-primary">&#x2713;</span>
              Blogger / Content creator trong lĩnh vực lifestyle
            </li>
          </ul>
        </div>

        {/* Form or success */}
        {success ? (
          <div className="mt-10 rounded-xl border-2 border-green-200 bg-green-50 p-8 text-center">
            <p className="text-2xl font-bold text-green-800">
              Cảm ơn bạn đã đăng ký!
            </p>
            <p className="mt-3 text-green-700">
              Chúng tôi sẽ xem xét và phản hồi trong 1-2 ngày làm việc qua email
              hoặc Zalo.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-10 space-y-5 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
          >
            <h2 className="font-heading text-xl font-semibold text-primary">
              Đăng ký làm Đối tác
            </h2>

            {/* Full name */}
            <div>
              <label className="block text-sm font-medium text-neutral-700">
                Họ tên <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className={inputClass}
              />
            </div>

            {/* Phone + Email */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  SĐT / Zalo <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder="0912345678"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Partner type + Channel */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  Loại đối tác <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={partnerType}
                  onChange={(e) => setPartnerType(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Chọn loại đối tác</option>
                  {PARTNER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  Kênh quảng bá chính <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={primaryChannel}
                  onChange={(e) => setPrimaryChannel(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Chọn kênh</option>
                  {CHANNELS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Social link */}
            <div>
              <label className="block text-sm font-medium text-neutral-700">
                Link profile MXH hoặc website
              </label>
              <input
                type="url"
                value={socialLink}
                onChange={(e) => setSocialLink(e.target.value)}
                placeholder="https://instagram.com/yourname"
                className={inputClass}
              />
            </div>

            {/* Estimated audience */}
            <div>
              <label className="block text-sm font-medium text-neutral-700">
                Số lượng followers / học viên ước tính
              </label>
              <input
                type="text"
                value={estimatedAudience}
                onChange={(e) => setEstimatedAudience(e.target.value)}
                placeholder="VD: 5000 followers Instagram, 200 học viên"
                className={inputClass}
              />
            </div>

            {/* Note */}
            <div>
              <label className="block text-sm font-medium text-neutral-700">
                Lý do muốn làm đối tác
              </label>
              <textarea
                value={applicationNote}
                onChange={(e) => setApplicationNote(e.target.value)}
                rows={3}
                placeholder="Chia sẻ về bạn và lý do muốn hợp tác..."
                className={inputClass}
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-secondary-light transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {submitting ? "Đang gửi..." : "Gửi đăng ký"}
            </button>
          </form>
        )}

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-neutral-400">
          Có câu hỏi? Liên hệ{" "}
          <a href="mailto:partner@bodix.vn" className="text-primary hover:underline">
            partner@bodix.vn
          </a>
        </p>
      </main>
    </div>
  );
}
