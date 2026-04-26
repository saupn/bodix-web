"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";

const DISMISS_KEY = "zalo_banner_dismiss_count";
const MAX_DISMISSALS = 3;

export function ZaloConnectBanner({ phoneVerified }: { phoneVerified: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (phoneVerified) return;
    try {
      const count = parseInt(localStorage.getItem(DISMISS_KEY) ?? "0", 10);
      if (count < MAX_DISMISSALS) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, [phoneVerified]);

  const handleDismiss = () => {
    setVisible(false);
    try {
      const count = parseInt(localStorage.getItem(DISMISS_KEY) ?? "0", 10);
      localStorage.setItem(DISMISS_KEY, String(count + 1));
    } catch {
      // ignore
    }
  };

  if (!visible) return null;

  return (
    <div className="relative rounded-xl border-2 border-[#0068FF]/30 bg-[#0068FF]/5 px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <div className="flex-1">
        <p className="font-medium text-[#0068FF]">
          Kết nối Zalo để nhận nhắc tập mỗi ngày
        </p>
        <p className="mt-0.5 text-sm text-neutral-600">
          Bạn sẽ nhận tin nhắn bài tập mỗi sáng 6:30 và hỗ trợ từ BodiX.
        </p>
      </div>
      <div className="mt-3 flex items-center gap-3 sm:mt-0">
        <Link
          href="/onboarding"
          className="inline-flex items-center rounded-lg bg-[#0068FF] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0055DD]"
        >
          Kết nối ngay
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg p-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
          aria-label="Đóng"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
