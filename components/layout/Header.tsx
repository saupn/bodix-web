"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { NAV_ITEMS } from "@/lib/constants";

function ScrollLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const isAnchor = href.startsWith("#");
  const path = isAnchor ? `/${href}` : href;

  const handleClick = (e: React.MouseEvent) => {
    if (isAnchor && href !== "#") {
      const targetId = href.slice(1);
      const element = document.getElementById(targetId);
      if (element) {
        e.preventDefault();
        element.scrollIntoView({ behavior: "smooth" });
        onClick?.();
      }
    }
  };

  return (
    <Link href={path} onClick={handleClick}>
      {children}
    </Link>
  );
}

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [isMobileMenuOpen]);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled
          ? "bg-white/95 backdrop-blur-md border-b border-neutral-200 shadow-sm"
          : "bg-black/30 backdrop-blur-sm border-b border-white/10"
      }`}
    >
      <div className="container mx-auto flex h-14 items-center justify-between px-4 sm:h-16 sm:px-6">
        <Link href="/" className="flex items-center">
          <Image
            src="/images/logo.png"
            alt="BodiX"
            width={140}
            height={48}
            className={`h-8 w-auto sm:h-10 md:h-12 transition-all ${
              !isScrolled ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : ""
            }`}
            priority
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_ITEMS.map((item) => (
            <ScrollLink
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isScrolled ? "text-neutral-700" : "text-white"
                }`}
              >
                {item.label}
              </span>
            </ScrollLink>
          ))}
          <ScrollLink href="#programs" onClick={() => setIsMobileMenuOpen(false)}>
            <span className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-secondary-light hover:bg-primary-dark transition-colors sm:px-5 sm:py-2.5">
              Bắt đầu ngay
            </span>
          </ScrollLink>
        </nav>

        {/* Mobile menu button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-neutral-100 transition-colors"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? (
            <X className="h-6 w-6 text-primary" />
          ) : (
            <Menu className="h-6 w-6 text-primary" />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-neutral-200 shadow-lg">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-2">
            {NAV_ITEMS.map((item) => (
              <ScrollLink
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span className="block py-3 text-neutral-700 font-medium hover:text-primary transition-colors">
                  {item.label}
                </span>
              </ScrollLink>
            ))}
            <ScrollLink href="#programs" onClick={() => setIsMobileMenuOpen(false)}>
              <span className="block py-3">
                <span className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-secondary-light w-full">
                  Bắt đầu ngay
                </span>
              </span>
            </ScrollLink>
          </nav>
        </div>
      )}
    </header>
  );
}
