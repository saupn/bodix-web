"use client";

import Link from "next/link";
import { AnimatedSection } from "./AnimatedSection";

export function Bodix21ProgramNav() {
  return (
    <section className="bg-neutral-100 py-12 md:py-16">
      <div className="container mx-auto max-w-[1200px] px-4 text-center">
        <AnimatedSection>
          <p className="text-lg text-neutral-700">
            Đã sẵn sàng cho thử thách lớn hơn?
          </p>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:justify-center sm:gap-8">
            <Link
              href="/bodix-6w"
              className="font-medium text-primary transition-colors hover:text-primary-dark hover:underline"
            >
              Xem BodiX 6W →
            </Link>
            <Link
              href="/bodix-12w"
              className="font-medium text-primary transition-colors hover:text-primary-dark hover:underline"
            >
              Xem BodiX 12W →
            </Link>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
