"use client";

import Link from "next/link";
import { AnimatedSection } from "./AnimatedSection";

export function Bodix12wFinalCTA() {
  return (
    <section
      id="cta"
      className="bg-gradient-to-b from-neutral-900 to-black py-12 md:py-20 text-white"
    >
      <div className="container mx-auto max-w-[1200px] px-4 text-center">
        <AnimatedSection>
          <h2 className="font-heading text-3xl font-bold md:text-4xl lg:text-5xl">
            12 tuần tới sẽ trôi qua.
          </h2>
        </AnimatedSection>
        <AnimatedSection>
          <p className="mt-8 text-xl opacity-95">
            Bạn muốn giữ cơ thể hiện tại – hay bước sang phiên bản khác?
          </p>
        </AnimatedSection>
        <AnimatedSection>
          <p className="mt-6 text-lg opacity-90">
            84 ngày từ bây giờ, bạn sẽ nhìn lại. Bạn sẽ thấy một người khác trong
            gương – hoặc bạn sẽ thấy cùng một người, với cùng những lời hứa chưa
            thực hiện.
          </p>
        </AnimatedSection>
        <AnimatedSection>
          <p className="mt-8 text-xl font-semibold">Quyết định là của bạn.</p>
        </AnimatedSection>
        <AnimatedSection>
          <div className="mt-12">
            <Link
              href="/signup"
              className="inline-flex items-center rounded-lg bg-accent px-10 py-4 text-lg font-bold text-white transition-colors hover:bg-accent-dark"
            >
              Bắt đầu hành trình →
            </Link>
          </div>
        </AnimatedSection>
        <AnimatedSection>
          <p className="mt-8 text-sm opacity-80">
            84 ngày. 72 buổi tập. Không đường tắt. Kết quả thật.
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}
