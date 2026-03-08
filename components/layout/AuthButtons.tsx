"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface AuthButtonsProps {
  isScrolled: boolean;
  onMobileMenuClose?: () => void;
  variant?: "desktop" | "mobile";
}

export function AuthButtons({
  isScrolled,
  onMobileMenuClose,
  variant = "desktop",
}: AuthButtonsProps) {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user ?? null);
    };
    getSession();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    setMounted(true);
    return () => data.subscription.unsubscribe();
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-3">
        <span className="h-9 w-20 animate-pulse rounded-lg bg-neutral-200" />
        <span className="h-9 w-24 animate-pulse rounded-lg bg-neutral-200" />
      </div>
    );
  }

  if (user) {
    return (
      <Link
        href="/app"
        onClick={onMobileMenuClose}
        className={`inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-secondary-light transition-colors hover:bg-primary-dark ${
          variant === "mobile" ? "w-full py-3" : ""
        }`}
      >
        Vào Dashboard
      </Link>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 sm:gap-3 ${
        variant === "mobile" ? "flex-col w-full" : ""
      }`}
    >
      <Link
        href="/login"
        onClick={onMobileMenuClose}
        className={`inline-flex items-center justify-center rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
          isScrolled
            ? "border-neutral-300 text-neutral-700 hover:border-primary hover:text-primary"
            : "border-white/50 text-white hover:border-white hover:bg-white/10"
        } ${variant === "mobile" ? "w-full py-3" : ""}`}
      >
        Đăng nhập
      </Link>
      <Link
        href="/signup"
        onClick={onMobileMenuClose}
        className={`inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-secondary-light transition-colors hover:bg-primary-dark ${
          variant === "mobile" ? "w-full py-3" : ""
        }`}
      >
        Đăng ký miễn phí
      </Link>
    </div>
  );
}
