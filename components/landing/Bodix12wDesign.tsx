"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { AnimatedSection } from "./AnimatedSection";

const pillars = [
  {
    icon: "📈",
    title: "Progression rõ ràng",
    description:
      "Mỗi tuần khó hơn tuần trước – có hệ thống, có mục đích",
  },
  {
    icon: "🔥",
    title: "Density tăng dần",
    description:
      "Nhiều hơn, nhanh hơn, ít nghỉ hơn – cơ thể buộc phải thích nghi",
  },
  {
    icon: "⏱️",
    title: "Kiểm soát tempo",
    description:
      "Không chỉ làm đúng, mà làm đúng cách – từng rep được tối ưu",
  },
  {
    icon: "⚖️",
    title: "Tối ưu body composition",
    description:
      "Giảm mỡ, tăng cơ, tái cấu trúc cơ thể từ bên trong",
  },
];

const phases = [
  {
    phase: "Phase 1",
    weeks: "Tuần 1-4",
    title: "Foundation",
    description:
      "Xây dựng nền tảng kỹ thuật và sức bền. Làm quen với nhịp độ của chương trình.",
  },
  {
    phase: "Phase 2",
    weeks: "Tuần 5-8",
    title: "Intensification",
    description:
      "Tăng cường độ. Đẩy giới hạn. Cơ thể bắt đầu thay đổi rõ rệt.",
  },
  {
    phase: "Phase 3",
    weeks: "Tuần 9-12",
    title: "Transformation",
    description:
      "Peak performance. Hoàn thành những gì bạn không nghĩ mình làm được ở tuần 1.",
  },
];

export function Bodix12wDesign() {
  return (
    <section id="design" className="bg-secondary py-12 md:py-20">
      <div className="container mx-auto max-w-[1200px] px-4">
        <AnimatedSection>
          <SectionHeading title="12 tuần được thiết kế cho sự thay đổi thực sự" />
        </AnimatedSection>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {pillars.map((pillar) => (
            <AnimatedSection key={pillar.title}>
              <div className="rounded-xl border-2 border-primary bg-white p-6 shadow-sm">
                <span className="text-4xl">{pillar.icon}</span>
                <h3 className="mt-4 font-heading text-xl font-bold text-primary">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-neutral-600">{pillar.description}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
        <div className="mt-16 space-y-6">
          {phases.map((phase) => (
            <AnimatedSection key={phase.phase}>
              <div className="rounded-xl border-2 border-primary-dark bg-primary/10 p-6 md:p-8">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="rounded bg-primary px-3 py-1 text-sm font-bold text-secondary-light">
                    {phase.phase}
                  </span>
                  <span className="font-semibold text-primary">
                    {phase.weeks}
                  </span>
                </div>
                <h3 className="mt-4 font-heading text-2xl font-bold text-primary">
                  {phase.title}
                </h3>
                <p className="mt-2 text-neutral-700">{phase.description}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
