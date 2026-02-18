"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { AnimatedSection } from "./AnimatedSection";

const problems = [
  {
    icon: "💸",
    title: "Mua khóa nhưng bỏ",
    description: "Mua khóa tập online rồi bỏ giữa chừng",
  },
  {
    icon: "📅",
    title: "Tập rồi ngưng",
    description: "Tập được vài ngày rồi ngưng, hứa \"tuần sau bắt đầu lại\"",
  },
  {
    icon: "⏰",
    title: "Mai tập bù",
    description: "Hôm nay bận, mai tập bù – rồi không bao giờ bù",
  },
  {
    icon: "📱",
    title: "Xem clip không hiệu quả",
    description: "Xem clip \"10 phút đốt mỡ\" nhưng 3 tháng sau vẫn không khác",
  },
];

export function Bodix21Problems() {
  return (
    <section id="problem" className="bg-white py-12 md:py-20">
      <div className="container mx-auto max-w-[1200px] px-4">
        <AnimatedSection>
          <SectionHeading
            title="Bạn không thiếu bài tập. Bạn thiếu cơ chế hoàn thành."
          />
        </AnimatedSection>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {problems.map((problem) => (
            <AnimatedSection key={problem.title}>
              <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                <span className="text-4xl">{problem.icon}</span>
                <h3 className="mt-4 font-heading text-lg font-semibold text-primary">
                  {problem.title}
                </h3>
                <p className="mt-2 text-neutral-600">{problem.description}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
        <AnimatedSection>
          <div className="mt-12 rounded-xl bg-secondary p-6 md:p-8">
            <p className="text-center text-neutral-700 md:text-lg">
              Vấn đề không phải là thiếu bài tập. Internet có hàng triệu video
              miễn phí. Vấn đề là bạn chưa có một hệ thống giúp bạn đi đến ngày
              cuối cùng.
            </p>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
