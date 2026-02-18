"use client";

import Link from "next/link";
import { AnimatedSection } from "./AnimatedSection";

export function Bodix12wProgramNav() {
  return (
    <section className="bg-neutral-800 py-12 md:py-16 text-white">
      <div className="container mx-auto max-w-[1200px] px-4">
        <AnimatedSection>
          <p className="text-center text-lg text-white/90">
            Chưa sẵn sàng? Bắt đầu từ đây:
          </p>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:justify-center sm:gap-12">
            <Link
              href="/bodix-21"
              className="text-center font-semibold text-accent-light transition-colors hover:text-accent"
            >
              → BodiX 21 (nền tảng)
            </Link>
            <Link
              href="/bodix-6w"
              className="text-center font-semibold text-accent-light transition-colors hover:text-accent"
            >
              → BodiX 6W (form rõ rệt)
            </Link>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
