"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const COOKIE_NAME = "bodix_ref";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

/** Reads ?ref= from URL and sets bodix_ref cookie for 30 days. */
export function RefCookieSetter() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref")?.trim().toUpperCase();
    if (!ref || ref.length < 3) return;

    // Set cookie (SameSite=Lax so it works on navigation)
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(ref)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;

    // Also store in localStorage as fallback
    try {
      localStorage.setItem("bodix_referral_code", ref);
    } catch {
      // ignore
    }

    // Track click
    fetch("/api/referral/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: ref,
        event: "click",
        metadata: { source: "query_param" },
      }),
    }).catch(() => {});
  }, [searchParams]);

  return null;
}
