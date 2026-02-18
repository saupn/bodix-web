"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { AnimatedSection } from "./AnimatedSection";

const results = [
  {
    icon: "📐",
    title: "Cơ thể gọn hơn",
    description:
      "Không phải giảm 10kg, nhưng bạn sẽ cảm nhận được sự khác biệt",
  },
  {
    icon: "⚡",
    title: "Cảm giác khỏe hơn",
    description:
      "Năng lượng tốt hơn, ngủ ngon hơn, ít mệt mỏi hơn",
  },
  {
    icon: "🧍",
    title: "Posture đẹp hơn",
    description:
      "Đứng thẳng hơn, tự tin hơn trong cách bạn mang cơ thể",
  },
  {
    icon: "🎯",
    title: "Kỷ luật hơn",
    description:
      "Lần đầu tiên hoàn thành một chương trình từ đầu đến cuối",
  },
];

export function Bodix21Results() {
  return (
    <section id="results" className="bg-white py-12 md:py-20">
      <div className="container mx-auto max-w-[1200px] px-4">
        <AnimatedSection>
          <SectionHeading title="Nếu bạn hoàn thành đủ 21 ngày" />
        </AnimatedSection>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {results.map((result) => (
            <AnimatedSection key={result.title}>
              <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                <span className="text-4xl">{result.icon}</span>
                <h3 className="mt-4 font-heading text-lg font-semibold text-primary">
                  {result.title}
                </h3>
                <p className="mt-2 text-neutral-600">{result.description}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
        <AnimatedSection>
          <p className="mt-12 max-w-2xl mx-auto text-center text-sm text-neutral-500">
            Không phải phép màu. 21 ngày không đủ để lột xác. Nhưng đủ để tạo
            nền tảng – nền tảng về thói quen, về cách bạn nhìn chính mình, và về
            niềm tin rằng bạn có thể đi đến cuối.
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}
