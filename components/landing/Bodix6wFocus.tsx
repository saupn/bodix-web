"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { AnimatedSection } from "./AnimatedSection";

const focusAreas = [
  {
    icon: "🔺",
    title: "Vai & Lưng",
    description:
      "Tạo khung chữ V – vai gọn, lưng thẳng, posture đẹp hơn",
  },
  {
    icon: "⭕",
    title: "Core",
    description: "Siết chặt hơn, eo nhỏ hơn, bụng phẳng hơn",
  },
  {
    icon: "📈",
    title: "Density",
    description: "Cơ săn chắc hơn, không phải to hơn – mà chặt hơn",
  },
  {
    icon: "⏱️",
    title: "Tempo",
    description:
      "Kiểm soát từng động tác, tối đa hóa hiệu quả mỗi rep",
  },
];

export function Bodix6wFocus() {
  return (
    <section id="focus" className="bg-secondary py-12 md:py-20">
      <div className="container mx-auto max-w-[1200px] px-4">
        <AnimatedSection>
          <SectionHeading
            title="6 tuần tập trung vào đường nét"
            subtitle="BodiX 6W được thiết kế để bạn bắt đầu nhìn thấy sự thay đổi trong gương."
          />
        </AnimatedSection>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {focusAreas.map((area) => (
            <AnimatedSection key={area.title}>
              <div className="rounded-xl border-2 border-primary/20 bg-white p-6 shadow-sm">
                <span className="text-4xl">{area.icon}</span>
                <h3 className="mt-4 font-heading text-xl font-semibold text-primary">
                  {area.title}
                </h3>
                <p className="mt-2 text-neutral-600">{area.description}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
        <AnimatedSection>
          <p className="mt-12 max-w-2xl mx-auto text-center text-neutral-700 md:text-lg">
            Sau 6 tuần, bạn không chỉ cảm thấy khỏe hơn – bạn bắt đầu nhìn thấy
            đường nét. Vai đẹp hơn trong áo hai dây. Eo rõ hơn trong váy ôm. Lưng
            thẳng hơn khi đứng trước gương.
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}
