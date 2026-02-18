"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AnimatedSection } from "./AnimatedSection";

const forYou = [
  "Đã hoàn thành BodiX 21 – Bạn đã chứng minh mình có thể đi đến cuối",
  "Đã có nền tảng tập luyện – Bạn đã tập đều đặn ít nhất 3-4 tuần gần đây",
  "Muốn thấy thay đổi rõ hơn – Không chỉ cảm thấy khỏe, mà muốn nhìn thấy sự khác biệt",
];

export function Bodix6wAudience() {
  return (
    <section id="audience" className="bg-secondary py-12 md:py-20">
      <div className="container mx-auto max-w-[1200px] px-4">
        <AnimatedSection>
          <SectionHeading title="BodiX 6W dành cho bạn nếu..." />
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
          <div className="mt-12 rounded-xl border-2 border-neutral-300 bg-white p-6">
            <h4 className="mb-4 flex items-center gap-2 font-heading font-semibold text-neutral-700">
              <X className="h-5 w-5 text-neutral-500" />
              Không phù hợp
            </h4>
            <ul className="space-y-3">
              <li className="flex gap-3 text-neutral-600">
                <span className="text-amber-600">✗</span>
                <span>
                  Bạn chưa từng hoàn thành một chương trình nào →{" "}
                  <Link
                    href="/bodix-21"
                    className="font-medium text-primary hover:underline"
                  >
                    Bắt đầu với BodiX 21
                  </Link>
                </span>
              </li>
              <li className="flex gap-3 text-neutral-600">
                <span className="text-amber-600">✗</span>
                <span>
                  Bạn vẫn còn đang tìm động lực để bắt đầu → BodiX 6W cần kỷ
                  luật, không cần động lực
                </span>
              </li>
            </ul>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
