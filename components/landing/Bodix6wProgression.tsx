"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { AnimatedSection } from "./AnimatedSection";

const phases = [
  {
    weeks: "Tuần 1-2",
    title: "Ổn định kỹ thuật",
    description:
      "Làm quen với các bài tập mới. Xây dựng kỹ thuật đúng. Chuẩn bị cơ thể cho những tuần tiếp theo.",
  },
  {
    weeks: "Tuần 3-4",
    title: "Tăng density",
    description:
      "Tăng số lượng và giảm thời gian nghỉ. Cơ thể bắt đầu thích nghi và thay đổi.",
  },
  {
    weeks: "Tuần 5-6",
    title: "Tăng thử thách",
    description:
      "Đẩy giới hạn. Hoàn thành những gì bạn không nghĩ mình làm được ở tuần 1.",
  },
];

export function Bodix6wProgression() {
  return (
    <section id="progression" className="bg-white py-12 md:py-20">
      <div className="container mx-auto max-w-[1200px] px-4">
        <AnimatedSection>
          <SectionHeading title="Tiến trình 6 tuần được thiết kế chi tiết" />
        </AnimatedSection>
        <div className="mt-12 space-y-8">
          {phases.map((phase) => (
            <AnimatedSection key={phase.weeks}>
              <div className="rounded-xl border-2 border-primary/20 bg-secondary-light p-6 md:p-8">
                <span className="inline-block rounded-lg bg-primary px-3 py-1 text-sm font-semibold text-secondary-light">
                  {phase.weeks}
                </span>
                <h3 className="mt-4 font-heading text-xl font-semibold text-primary">
                  {phase.title}
                </h3>
                <p className="mt-2 text-neutral-600">{phase.description}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
        <AnimatedSection>
          <p className="mt-12 max-w-2xl mx-auto text-center text-neutral-600">
            Không nhảy bài lung tung. Không đổi động tác liên tục để tạo cảm giác
            mới. Lặp lại có kiểm soát để cơ thể thích nghi và thay đổi thực sự.
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}
