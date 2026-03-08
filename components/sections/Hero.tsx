"use client";

import Link from "next/link";
import { SITE } from "@/lib/constants";

function ScrollLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
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
    <Link href={path} onClick={handleClick}>
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
          className="font-heading text-3xl font-bold text-white drop-shadow-lg sm:text-4xl md:text-5xl lg:text-6xl animate-fade-slide-up leading-tight"
          style={{ animationDelay: "0.1s" }}
        >
          {SITE.slogan}
        </h1>
        <p
          className="mt-6 text-lg font-medium text-white opacity-0 drop-shadow-md max-w-2xl mx-auto animate-fade-slide-up sm:text-xl md:text-2xl leading-relaxed"
          style={{ animationDelay: "0.3s" }}
        >
          BodiX giúp bạn hoàn thành hành trình thay đổi cơ thể với chương trình
          có điểm đầu, điểm cuối rõ ràng. Tập tại nhà, mỗi ngày 10-25 phút, có
          người đồng hành.
        </p>
        <div
          className="mt-10 flex flex-col gap-4 justify-center opacity-0 animate-fade-slide-up sm:flex-row sm:gap-4"
          style={{ animationDelay: "0.5s" }}
        >
          <Link href="/signup">
            <span className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-6 py-3.5 text-base font-medium text-secondary-light transition-colors hover:bg-primary-dark sm:w-auto sm:px-8 sm:py-4">
              Bắt đầu miễn phí 3 ngày
            </span>
          </Link>
          <ScrollLink href="#why-different">
            <span className="inline-flex w-full items-center justify-center rounded-lg border-2 border-white bg-white/10 px-6 py-3.5 text-base font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20 sm:w-auto sm:px-8 sm:py-4">
              Tìm hiểu thêm ↓
            </span>
          </ScrollLink>
        </div>
        <p
          className="mt-6 text-sm text-secondary-light/80 opacity-0 animate-fade-slide-up"
          style={{ animationDelay: "0.6s" }}
        >
          Chương trình dành cho Nữ. Phiên bản Nam sắp ra mắt!
        </p>
      </div>
    </section>
  );
}
