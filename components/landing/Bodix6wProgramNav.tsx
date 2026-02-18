"use client";

import Link from "next/link";
import { AnimatedSection } from "./AnimatedSection";

export function Bodix6wProgramNav() {
  return (
    <section className="bg-neutral-100 py-12 md:py-16">
      <div className="container mx-auto max-w-[1200px] px-4">
        <div className="flex flex-col gap-6 sm:flex-row sm:justify-center sm:gap-12">
          <AnimatedSection>
            <Link
              href="/bodix-21"
              className="block text-center font-medium text-primary transition-colors hover:text-primary-dark hover:underline"
            >
              Cần xây nền tảng trước? → Xem BodiX 21
            </Link>
          </AnimatedSection>
          <AnimatedSection>
            <Link
              href="/bodix-12w"
              className="block text-center font-medium text-primary transition-colors hover:text-primary-dark hover:underline"
            >
              Sẵn sàng cam kết 12 tuần? → Xem BodiX 12W
            </Link>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
