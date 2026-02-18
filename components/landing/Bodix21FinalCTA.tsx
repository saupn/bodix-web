"use client";

import Link from "next/link";
import { AnimatedSection } from "./AnimatedSection";

export function Bodix21FinalCTA() {
  return (
    <section id="cta" className="bg-primary py-12 md:py-20 text-white">
      <div className="container mx-auto max-w-[1200px] px-4 text-center">
        <AnimatedSection>
          <h2 className="font-heading text-3xl font-bold md:text-4xl">
            21 ngày tới sẽ trôi qua.
          </h2>
        </AnimatedSection>
        <AnimatedSection>
          <p className="mt-6 text-lg opacity-90">
            Dù bạn có tham gia hay không, 21 ngày tới vẫn sẽ đến và đi. Câu hỏi
            là: bạn muốn trôi qua trong trạng thái nào?
          </p>
        </AnimatedSection>
        <AnimatedSection>
          <p className="mt-4 text-lg opacity-90">
            Vẫn như cũ – hứa rồi bỏ, bắt đầu rồi dừng? Hay khác đi – lần đầu
            tiên hoàn thành một hành trình từ đầu đến cuối?
          </p>
        </AnimatedSection>
        <AnimatedSection>
          <div className="mt-10">
            <Link
              href="#cta"
              className="inline-flex items-center rounded-lg bg-accent px-8 py-4 text-base font-medium text-white transition-colors hover:bg-accent-dark"
            >
              Tham gia BodiX 21 ngay →
            </Link>
          </div>
        </AnimatedSection>
        <AnimatedSection>
          <p className="mt-6 text-sm opacity-80">
            Bắt đầu ngay hôm nay. Ngày 1 đang chờ bạn.
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}
