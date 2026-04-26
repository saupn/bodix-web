"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera } from "lucide-react";

const PHOTO_TYPES = [
  { id: "before", label: "Ngày 1 (Before)" },
  { id: "weekly", label: "Tuần (cần chọn tuần)" },
  { id: "midpoint", label: "Giữa chương trình" },
  { id: "after", label: "Kết thúc (After)" },
] as const;

export default function PhotosPage() {
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [photoType, setPhotoType] = useState<string>("before");
  const [weekNumber, setWeekNumber] = useState<string>("1");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/program/active");
      if (!res.ok) return;
      const prog = await res.json();
      setEnrollmentId(prog.enrollment?.id ?? null);
    };
    load();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setError("Chỉ chấp nhận JPEG, PNG, WebP.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("File không được vượt quá 5 MB.");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollmentId || !file) return;
    if ((photoType === "weekly" || photoType === "midpoint") && !weekNumber) {
      setError("Chọn số tuần cho ảnh weekly/midpoint.");
      return;
    }
    setUploading(true);
    setError(null);
    setSuccess(false);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("enrollment_id", enrollmentId);
      formData.append("photo_type", photoType);
      if (photoType === "weekly" || photoType === "midpoint") {
        formData.append("week_number", weekNumber);
      }
      const res = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload thất bại.");
        return;
      }
      setSuccess(true);
      setFile(null);
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  if (!enrollmentId) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-neutral-200 bg-white p-6 text-center">
        <p className="text-neutral-600">Bạn chưa có chương trình đang hoạt động.</p>
        <Link href="/app" className="mt-4 inline-block font-medium text-primary">
          Về trang chủ →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-primary">
          📸 Ảnh tiến bộ
        </h1>
        <Link
          href="/app/review/history"
          className="text-sm font-medium text-primary hover:underline"
        >
          Xem lịch sử →
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
      >
        <h2 className="font-heading font-semibold text-primary">
          Upload ảnh mới
        </h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium">Loại ảnh</label>
            <select
              value={photoType}
              onChange={(e) => setPhotoType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              {PHOTO_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          {(photoType === "weekly" || photoType === "midpoint") && (
            <div>
              <label className="block text-sm font-medium">Tuần</label>
              <select
                value={weekNumber}
                onChange={(e) => setWeekNumber(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                {[1, 2, 3, 4, 5, 6].map((w) => (
                  <option key={w} value={w}>
                    Tuần {w}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium">Chọn ảnh</label>
            <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 p-8 hover:border-primary/50">
              <Camera className="h-10 w-10 text-neutral-600" />
              <span className="mt-2 text-sm text-neutral-600">
                {file ? file.name : "Nhấn để chọn ảnh (JPEG, PNG, WebP, tối đa 5MB)"}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            {preview && (
              <img
                src={preview}
                alt=""
                className="mt-2 aspect-square max-h-40 w-full rounded-lg object-cover"
              />
            )}
          </div>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}
        {success && (
          <p className="mt-3 text-sm text-success">Upload thành công!</p>
        )}
        <button
          type="submit"
          disabled={!file || uploading}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-medium text-secondary-light transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          <Camera className="h-4 w-4" />
          {uploading ? "Đang upload..." : "Upload ảnh"}
        </button>
      </form>
    </div>
  );
}
