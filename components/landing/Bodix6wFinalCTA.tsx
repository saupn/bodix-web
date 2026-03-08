"use client";

import Link from "next/link";
import { AnimatedSection } from "./AnimatedSection";

export function Bodix6wFinalCTA() {
  return (
    <section id="cta" className="bg-primary py-12 md:py-20 text-white">
      <div className="container mx-auto max-w-[1200px] px-4 text-center">
        <AnimatedSection>
          <h2 className="font-heading text-3xl font-bold md:text-4xl">
            6 tuần tới sẽ quyết định form của bạn trong 6 tháng tới.
          </h2>
        </AnimatedSection>
        <AnimatedSection>
          <p className="mt-6 text-lg opacity-90">
            Cơ thể bạn hôm nay là kết quả của những gì bạn làm 6 tuần trước. Cơ
            thể bạn 6 tháng tới sẽ là kết quả của những gì bạn làm từ hôm nay.
          </p>
        </AnimatedSection>
        <AnimatedSection>
          <div className="mt-10">
            <Link
              href="/signup"
              className="inline-flex items-center rounded-lg bg-accent px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-accent-dark"
            >
              Đăng ký miễn phí →
            </Link>
          </div>
        </AnimatedSection>
        <AnimatedSection>
          <p className="mt-6 text-sm opacity-80">
            42 ngày. 36 buổi tập. Một phiên bản khác của bạn đang chờ.
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}
