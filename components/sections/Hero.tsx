"use client";

import Link from "next/link";
import { SITE } from "@/lib/constants";

function ScrollLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
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
      }
    }
  };

  return (
    <Link href={path} onClick={handleClick} className={className}>
      {children}
    </Link>
  );
}

export function Hero() {
  return (
    <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden">
      {/* Video background */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src="/videos/hero1.mp4" type="video/mp4" />
      </video>

      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Content */}
      <div className="container relative z-10 mx-auto max-w-[1200px] px-4 py-12 text-center sm:px-6">
        <h1
          className="font-heading text-4xl font-bold text-white drop-shadow-lg sm:text-5xl md:text-6xl lg:text-7xl animate-fade-slide-up"
          style={{ animationDelay: "0.1s" }}
        >
          {SITE.name}
        </h1>
        <p
          className="mt-4 text-secondary-light font-medium uppercase tracking-wider text-sm opacity-0 drop-shadow-md animate-fade-slide-up sm:text-base"
          style={{ animationDelay: "0.2s" }}
        >
          {SITE.tagline}
        </p>
        <p
          className="mt-6 text-lg font-medium text-white opacity-0 drop-shadow-md max-w-2xl mx-auto animate-fade-slide-up sm:text-xl md:text-2xl"
          style={{ animationDelay: "0.3s" }}
        >
          {SITE.slogan}
        </p>
        <p
          className="mt-6 text-secondary-light opacity-0 max-w-xl mx-auto animate-fade-slide-up drop-shadow-sm"
          style={{ animationDelay: "0.4s" }}
        >
          Chương trình tập luyện được thiết kế để bạn đi đến ngày cuối cùng, không
          phải để bạn bỏ giữa chừng như những lần trước.
        </p>
        <div
          className="mt-10 flex flex-col gap-4 justify-center opacity-0 animate-fade-slide-up sm:flex-row sm:gap-4"
          style={{ animationDelay: "0.5s" }}
        >
          <ScrollLink href="#programs">
            <span className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-6 py-3.5 text-base font-medium text-secondary-light transition-colors hover:bg-primary-dark sm:w-auto sm:px-8 sm:py-4">
              Khám phá chương trình
            </span>
          </ScrollLink>
          <ScrollLink href="#philosophy">
            <span className="inline-flex w-full items-center justify-center rounded-lg border-2 border-white bg-white/10 px-6 py-3.5 text-base font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20 sm:w-auto sm:px-8 sm:py-4">
              Tìm hiểu triết lý ↓
            </span>
          </ScrollLink>
        </div>
      </div>
    </section>
  );
}
