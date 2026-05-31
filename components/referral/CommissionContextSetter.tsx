"use client";

import { useEffect } from "react";

const MAX_AGE = 30 * 24 * 60 * 60; // 30 ngày (giây)

/**
 * Set cookie context khi user vào /r/CODE hoặc /af/CODE.
 *
 *   code_context  → 'referral' | 'affiliate' (quyết định loại commission)
 *   referral_code → CODE (checkout/create đọc qua readCommissionContext)
 *   bodix_ref     → CODE (để CheckoutForm prefill ô mã giới thiệu — tương thích
 *                   flow ?ref= cũ)
 *
 * Cookie hết hạn sau 30 ngày. Context được "đóng băng" lên enrollment tại
 * checkout nên không cần chủ động xoá ở đây.
 */
export function CommissionContextSetter({
  code,
  context,
}: {
  code: string;
  context: "referral" | "affiliate";
}) {
  useEffect(() => {
    const value = code.trim().toUpperCase();
    if (!value || value.length < 3) return;

    const opts = `path=/; max-age=${MAX_AGE}; SameSite=Lax`;
    document.cookie = `code_context=${context}; ${opts}`;
    document.cookie = `referral_code=${encodeURIComponent(value)}; ${opts}`;
    document.cookie = `bodix_ref=${encodeURIComponent(value)}; ${opts}`;

    try {
      localStorage.setItem("bodix_referral_code", value);
    } catch {
      // ignore
    }
  }, [code, context]);

  return null;
}
