"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AnimatedSection } from "./AnimatedSection";

const forYou = [
  "Bạn là người mới bắt đầu – Chưa từng tập luyện đều đặn, hoặc đã nghỉ rất lâu và muốn bắt đầu lại",
  "Bạn từng bỏ giữa chừng nhiều lần – Đã thử nhiều chương trình nhưng chưa lần nào đi đến cuối",
  "Bạn muốn xây nền tảng trước – Không vội vàng, muốn bắt đầu đúng cách",
];

export function Bodix21Audience() {
  return (
    <section id="audience" className="bg-secondary py-12 md:py-20">
      <div className="container mx-auto max-w-[1200px] px-4">
        <AnimatedSection>
          <SectionHeading title="BodiX 21 dành cho bạn nếu..." />
        </AnimatedSection>
        <div className="mt-12 space-y-6">
          {forYou.map((item) => (
            <AnimatedSection key={item.slice(0, 30)}>
              <div className="flex gap-4 rounded-xl border border-neutral-200 bg-white p-6">
                <Check className="h-6 w-6 shrink-0 text-success" />
                <p className="text-neutral-700">{item}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
        <AnimatedSection>
          <p className="mt-12 text-center text-sm text-neutral-600">
            Đã có nền tảng và muốn thử thách hơn?{" "}
            <Link href="/bodix-6w" className="font-medium text-primary hover:underline">
              Xem BodiX 6W
            </Link>{" "}
            hoặc{" "}
            <Link href="/bodix-12w" className="font-medium text-primary hover:underline">
              BodiX 12W
            </Link>
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}
