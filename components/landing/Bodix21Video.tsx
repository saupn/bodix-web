"use client";

import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AnimatedSection } from "./AnimatedSection";

export function Bodix21Video() {
  return (
    <section id="video" className="bg-white py-12 md:py-20">
      <div className="container mx-auto max-w-[1200px] px-4">
        <AnimatedSection>
          <SectionHeading title="Xem trước khi bắt đầu" />
        </AnimatedSection>
        <AnimatedSection>
          <div className="mx-auto mt-12 max-w-4xl">
            <div className="aspect-video w-full rounded-xl bg-neutral-200 flex items-center justify-center">
              <span className="text-neutral-500">Video placeholder</span>
            </div>
            <p className="mt-6 text-center text-neutral-600">
              Video này giải thích cách BodiX 21 hoạt động, triết lý Completion
              First, và những gì bạn cần chuẩn bị. Xem xong, bạn có thể mở Day 1
              ngay.
            </p>
            <div className="mt-8 text-center">
              <Link
                href="#cta"
                className="inline-flex items-center rounded-lg bg-primary px-8 py-4 text-base font-medium text-secondary-light transition-colors hover:bg-primary-dark"
              >
                Tôi đã xem xong – Bắt đầu ngay →
              </Link>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
