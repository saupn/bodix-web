"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { AnimatedSection } from "./AnimatedSection";

const results = [
  {
    icon: "💪",
    title: "Cơ săn chắc hơn rõ rệt",
    description: "Không phải to hơn, mà chặt hơn, gọn hơn",
  },
  {
    icon: "📐",
    title: "Đường nét bắt đầu hiện rõ",
    description: "Vai, lưng, eo – bạn nhìn thấy sự thay đổi",
  },
  {
    icon: "🏃",
    title: "Sức bền cải thiện mạnh",
    description: "Leo cầu thang không còn thở dốc",
  },
  {
    icon: "👗",
    title: "Tự tin hơn khi mặc đồ ôm",
    description: "Không còn né tránh gương hay camera",
  },
];

export function Bodix6wResults() {
  return (
    <section id="results" className="bg-white py-12 md:py-20">
      <div className="container mx-auto max-w-[1200px] px-4">
        <AnimatedSection>
          <SectionHeading title="Nếu bạn hoàn thành đủ 6 tuần" />
        </AnimatedSection>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {results.map((result) => (
            <AnimatedSection key={result.title}>
              <div className="rounded-xl border-2 border-primary/10 bg-white p-6 shadow-sm">
                <span className="text-4xl">{result.icon}</span>
                <h3 className="mt-4 font-heading text-xl font-semibold text-primary">
                  {result.title}
                </h3>
                <p className="mt-2 text-neutral-600">{result.description}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
