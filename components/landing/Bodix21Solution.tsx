"use client";

import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AnimatedSection } from "./AnimatedSection";

const levels = [
  {
    icon: "💪",
    name: "Hard",
    description:
      "Khi bạn đủ sức, đủ năng lượng, muốn thử thách bản thân",
    color: "accent",
  },
  {
    icon: "🌿",
    name: "Light",
    description:
      "Khi bạn hơi mệt, bận rộn, nhưng vẫn muốn giữ nhịp",
    color: "success",
  },
  {
    icon: "🧘",
    name: "Recovery",
    description:
      "Khi cơ thể cần phục hồi, cần nhẹ nhàng hơn",
    color: "primary",
  },
];

const colorClasses = {
  accent: "border-accent bg-accent/10 text-accent-dark",
  success: "border-success bg-success/10 text-success",
  primary: "border-primary bg-primary/10 text-primary",
};

export function Bodix21Solution() {
  return (
    <section id="solution" className="bg-secondary py-12 md:py-20">
      <div className="container mx-auto max-w-[1200px] px-4">
        <AnimatedSection>
          <SectionHeading
            title="Thiết kế để bạn không bỏ giữa chừng"
            subtitle="Mỗi ngày chỉ có một nhiệm vụ duy nhất: hoàn thành."
          />
        </AnimatedSection>
        <AnimatedSection>
          <p className="mt-8 max-w-2xl mx-auto text-center text-neutral-700">
            Trong BodiX 21, bạn không bao giờ phải &quot;bỏ buổi&quot;. Thay vào
            đó, mỗi ngày bạn chọn mức phù hợp với trạng thái của mình:
          </p>
        </AnimatedSection>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {levels.map((level) => (
            <AnimatedSection key={level.name}>
              <div
                className={`rounded-xl border-2 p-6 ${colorClasses[level.color as keyof typeof colorClasses]}`}
              >
                <span className="text-4xl">{level.icon}</span>
                <h3 className="mt-4 font-heading text-xl font-semibold">
                  {level.name}
                </h3>
                <p className="mt-2 text-sm opacity-90">{level.description}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
        <AnimatedSection>
          <p className="mt-12 max-w-2xl mx-auto text-center text-neutral-700">
            Dù chọn mức nào, bạn vẫn hoàn thành ngày hôm đó. Không có cảm giác
            tội lỗi. Không có &quot;bỏ buổi&quot;. Chỉ có tiến về phía trước.
          </p>
        </AnimatedSection>
        <AnimatedSection>
          <p className="mt-6 max-w-2xl mx-auto text-center text-neutral-700">
            Đó là cách cơ thể bắt đầu thay đổi – không phải bằng một buổi tập kỷ
            lục, mà bằng việc xuất hiện mỗi ngày.
          </p>
        </AnimatedSection>
        <AnimatedSection>
          <div className="mt-12 text-center">
            <Link
              href="#cta"
              className="inline-flex items-center rounded-lg bg-primary px-8 py-4 text-base font-medium text-secondary-light transition-colors hover:bg-primary-dark"
            >
              Tôi muốn bắt đầu 21 ngày →
            </Link>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
