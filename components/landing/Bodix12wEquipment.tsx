"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { AnimatedSection } from "./AnimatedSection";

const equipment = [
  {
    icon: "🧘",
    item: "Thảm tập yoga hoặc thảm fitness",
  },
  {
    icon: "🏋️",
    item: "Tạ tay (2-5kg mỗi bên, tùy sức)",
  },
  {
    icon: "🔗",
    item: "Dây kháng lực (resistance band)",
  },
  {
    icon: "⏱️",
    item: "40-50 phút mỗi ngày",
  },
  {
    icon: "🧠",
    item: "Quyết tâm hoàn thành 84 ngày",
  },
];

export function Bodix12wEquipment() {
  return (
    <section className="bg-white py-12 md:py-20">
      <div className="container mx-auto max-w-[1200px] px-4">
        <AnimatedSection>
          <SectionHeading title="Bạn cần chuẩn bị gì?" />
        </AnimatedSection>
        <AnimatedSection>
          <ul className="mx-auto mt-12 max-w-2xl space-y-4">
            {equipment.map(({ icon, item }) => (
              <li
                key={item}
                className="flex items-center gap-4 rounded-xl border-2 border-neutral-200 bg-neutral-50 px-6 py-4"
              >
                <span className="text-3xl">{icon}</span>
                <span className="font-medium text-neutral-800">{item}</span>
              </li>
            ))}
          </ul>
        </AnimatedSection>
      </div>
    </section>
  );
}
