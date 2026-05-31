"use client";

import { useEffect, useState } from "react";

export interface BankInfo {
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
}

interface BankInfoFormProps {
  /** Giá trị đã lưu trong DB (từ dashboard API). */
  initial: BankInfo | null | undefined;
  /** Gọi sau khi lưu thành công với giá trị mới (parent đồng bộ state). */
  onSaved?: (info: { bank_name: string; bank_account_number: string; bank_account_name: string }) => void;
}

/**
 * Form Thông tin ngân hàng cho affiliate dashboard.
 *
 * Fix BD-AFFILIATE-REFERRAL-FIXES (1.B): prefill 3 field từ DB khi mount/khi
 * `initial` thay đổi (đồng bộ qua useEffect — tránh race khi dashboard load
 * sau lần render đầu). Có loading/saving/saved state; save → PATCH → onSaved.
 */
export function BankInfoForm({ initial, onSaved }: BankInfoFormProps) {
  const [form, setForm] = useState({
    bank_name: "",
    bank_account_number: "",
    bank_account_name: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Đồng bộ prefill mỗi khi dữ liệu DB về (hoặc đổi). Đây là điểm fix chính:
  // form luôn phản ánh giá trị đã lưu khi user vào lại trang.
  useEffect(() => {
    setForm({
      bank_name: initial?.bank_name ?? "",
      bank_account_number: initial?.bank_account_number ?? "",
      bank_account_name: initial?.bank_account_name ?? "",
    });
  }, [initial?.bank_name, initial?.bank_account_number, initial?.bank_account_name]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/affiliate/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSaved(true);
        onSaved?.({ ...form });
        setTimeout(() => setSaved(false), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Không thể lưu. Vui lòng thử lại.");
      }
    } catch {
      setError("Không thể kết nối. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium">Thông tin ngân hàng</label>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <input
          type="text"
          placeholder="Ngân hàng"
          value={form.bank_name}
          onChange={(e) => setForm((p) => ({ ...p, bank_name: e.target.value }))}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Số tài khoản"
          value={form.bank_account_number}
          onChange={(e) => setForm((p) => ({ ...p, bank_account_number: e.target.value }))}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Tên chủ tài khoản"
          value={form.bank_account_name}
          onChange={(e) => setForm((p) => ({ ...p, bank_account_name: e.target.value }))}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
        >
          {saving ? "Đang lưu..." : "Lưu thông tin"}
        </button>
        {saved && <span className="text-sm text-success">✓ Đã lưu</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
